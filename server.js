const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./src/roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://metincatal.github.io',
      'https://bearoffbattle.onrender.com'
    ],
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cleanup stale rooms every 2 minutes
setInterval(() => {
  const stale = roomManager.cleanupStaleRooms();
  if (stale.length > 0) {
    console.log(`Cleaned up ${stale.length} stale rooms`);
    broadcastLobbyUpdate();
    broadcastOnlineCount();
  }
}, 2 * 60 * 1000);

function broadcastLobbyUpdate() {
  const rooms = roomManager.getOpenRooms();
  io.emit('lobby-update', { rooms });
}

function broadcastOnlineCount() {
  io.emit('online-count', { count: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  socket.nickname = 'Anonim';

  // Broadcast updated online count
  broadcastOnlineCount();

  // ─── Nickname ───────────────────────────────────────────────
  socket.on('set-nickname', ({ nickname }) => {
    socket.nickname = (nickname || 'Anonim').slice(0, 16);
  });

  // ─── Online count ───────────────────────────────────────────
  socket.on('get-online-count', () => {
    socket.emit('online-count', { count: io.engine.clientsCount });
  });

  // ─── Lobby ──────────────────────────────────────────────────
  socket.on('get-lobby', () => {
    const rooms = roomManager.getOpenRooms();
    socket.emit('lobby-data', { rooms });
  });

  // ─── Create Room ────────────────────────────────────────────
  socket.on('create-room', (data = {}) => {
    // Leave any existing room first
    const existingRoom = roomManager.findPlayerRoom(socket.id);
    if (existingRoom) {
      const result = roomManager.leaveRoom(socket.id);
      if (result) {
        socket.leave(result.roomId);
        if (!result.deleted && result.room) {
          io.to(result.roomId).emit('player-left', { socketId: socket.id });
          io.to(result.roomId).emit('room-update', roomManager.getRoomInfo(result.roomId));
        }
      }
    }

    const room = roomManager.createRoom(socket.id, {
      name: data.name,
      type: data.type,
      betAmount: data.betAmount,
      nickname: socket.nickname
    });
    socket.join(room.id);
    socket.emit('room-created', {
      roomId: room.id,
      color: 'white',
      roomInfo: roomManager.getRoomInfo(room.id)
    });

    // Broadcast to lobby & notify
    broadcastLobbyUpdate();
    if (room.type !== 'private') {
      socket.broadcast.emit('room-notification', {
        type: 'new-room',
        message: `${socket.nickname} yeni bir oda oluşturdu!`,
        roomId: room.id,
        roomName: room.name
      });
    }
  });

  // ─── Join Room (direct) ─────────────────────────────────────
  socket.on('join-room', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (room && room.type === 'invite') {
      // Invite mode → send request instead of direct join
      const reqResult = roomManager.requestJoin(roomId, socket.id, socket.nickname);
      if (!reqResult.success) {
        socket.emit('join-error', { message: reqResult.message });
        return;
      }
      socket.emit('join-requested', { roomId });
      io.to(roomId).emit('join-request', {
        roomId,
        requesterId: socket.id,
        nickname: socket.nickname
      });
      return;
    }

    const result = roomManager.joinRoom(roomId, socket.id, socket.nickname);
    if (!result.success) {
      socket.emit('join-error', { message: result.message });
      return;
    }
    socket.join(roomId);
    socket.emit('room-joined', {
      roomId,
      color: 'black',
      roomInfo: roomManager.getRoomInfo(roomId)
    });
    io.to(roomId).emit('room-update', roomManager.getRoomInfo(roomId));
    io.to(roomId).emit('player-joined', { roomId, nickname: socket.nickname });
    broadcastLobbyUpdate();
  });

  // ─── Request Join (invite mode) ─────────────────────────────
  socket.on('request-join', ({ roomId }) => {
    const result = roomManager.requestJoin(roomId, socket.id, socket.nickname);
    if (!result.success) {
      socket.emit('join-error', { message: result.message });
      return;
    }
    socket.emit('join-requested', { roomId });
    io.to(roomId).emit('join-request', {
      roomId,
      requesterId: socket.id,
      nickname: socket.nickname
    });
  });

  // ─── Approve / Reject Join ──────────────────────────────────
  socket.on('approve-join', ({ roomId, requesterId }) => {
    const result = roomManager.approveJoin(roomId, socket.id, requesterId);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    const requesterSocket = io.sockets.sockets.get(requesterId);
    if (requesterSocket) {
      requesterSocket.join(roomId);
      requesterSocket.emit('room-joined', {
        roomId,
        color: 'black',
        roomInfo: roomManager.getRoomInfo(roomId)
      });
    }
    io.to(roomId).emit('room-update', roomManager.getRoomInfo(roomId));
    io.to(roomId).emit('player-joined', { roomId });
    broadcastLobbyUpdate();
  });

  socket.on('reject-join', ({ roomId, requesterId }) => {
    roomManager.rejectJoin(roomId, socket.id, requesterId);
    const requesterSocket = io.sockets.sockets.get(requesterId);
    if (requesterSocket) {
      requesterSocket.emit('join-rejected', { roomId, message: 'İsteğiniz reddedildi.' });
    }
  });

  // ─── Ready ──────────────────────────────────────────────────
  socket.on('set-ready', ({ roomId, ready }) => {
    const result = roomManager.setReady(roomId, socket.id, ready);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('room-update', roomManager.getRoomInfo(roomId));

    if (result.allReady) {
      const gameState = roomManager.startGame(roomId);
      io.to(roomId).emit('game-started', { gameState, roomInfo: roomManager.getRoomInfo(roomId) });
      broadcastLobbyUpdate();
    }
  });

  // ─── Leave Room ─────────────────────────────────────────────
  socket.on('leave-room', () => {
    const result = roomManager.leaveRoom(socket.id);
    if (!result) return;
    socket.leave(result.roomId);
    socket.emit('room-left');
    if (!result.deleted && result.room) {
      io.to(result.roomId).emit('player-left', { socketId: socket.id });
      io.to(result.roomId).emit('room-update', roomManager.getRoomInfo(result.roomId));
    }
    broadcastLobbyUpdate();
  });

  // ─── Roll Dice ──────────────────────────────────────────────
  socket.on('roll-dice', ({ roomId }) => {
    const result = roomManager.rollDice(roomId, socket.id);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('dice-rolled', { dice: result.dice, player: result.player });
  });

  // ─── Make Move ──────────────────────────────────────────────
  socket.on('make-move', ({ roomId, move }) => {
    const result = roomManager.applyMove(roomId, socket.id, move);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('move-made', { gameState: result.gameState, move });

    if (result.gameOver) {
      const room = roomManager.getRoom(roomId);
      io.to(roomId).emit('game-over', {
        winner: result.winner,
        type: result.gameType || 'normal',
        cubeValue: room ? room.doublingCube.value : 1,
        betAmount: room ? room.betAmount : 0
      });
      roomManager.finishRoom(roomId);
      broadcastLobbyUpdate();
    } else if (result.turnChanged) {
      io.to(roomId).emit('turn-changed', { currentPlayer: result.gameState.currentPlayer });
    }
  });

  // ─── Doubling Cube ─────────────────────────────────────────
  socket.on('offer-double', ({ roomId }) => {
    const result = roomManager.offerDouble(roomId, socket.id);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('double-offered', { cube: result.cube });
  });

  socket.on('respond-double', ({ roomId, accept }) => {
    const result = roomManager.respondToDouble(roomId, socket.id, accept);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    if (result.accepted) {
      io.to(roomId).emit('double-accepted', { cube: result.cube });
    } else {
      const room = roomManager.getRoom(roomId);
      io.to(roomId).emit('double-declined', { winner: result.winner });
      io.to(roomId).emit('game-over', {
        winner: result.winner,
        type: 'double-decline',
        cubeValue: room ? room.doublingCube.value : 1,
        betAmount: room ? room.betAmount : 0
      });
      roomManager.finishRoom(roomId);
      broadcastLobbyUpdate();
    }
  });

  // ─── Resign ─────────────────────────────────────────────────
  socket.on('resign', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const winner = player.color === 'white' ? 'black' : 'white';
    io.to(roomId).emit('game-over', {
      winner,
      type: 'resign',
      cubeValue: room.doublingCube.value,
      betAmount: room.betAmount
    });
    roomManager.finishRoom(roomId);
    broadcastLobbyUpdate();
  });

  // ─── Disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const roomId = roomManager.findPlayerRoom(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      if (room && room.status === 'playing') {
        // In-game disconnect → opponent wins
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          const winner = player.color === 'white' ? 'black' : 'white';
          io.to(roomId).emit('game-over', {
            winner,
            type: 'disconnect',
            cubeValue: room.doublingCube.value,
            betAmount: room.betAmount
          });
          roomManager.finishRoom(roomId);
        }
      }
      io.to(roomId).emit('player-left', { socketId: socket.id });
      roomManager.removePlayer(socket.id);
      broadcastLobbyUpdate();
    }
    broadcastOnlineCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
