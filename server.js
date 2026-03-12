const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./src/roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const roomManager = new RoomManager();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create-room', () => {
    const room = roomManager.createRoom(socket.id);
    socket.join(room.id);
    socket.emit('room-created', { roomId: room.id, color: 'white' });
  });

  socket.on('join-room', ({ roomId }) => {
    const result = roomManager.joinRoom(roomId, socket.id);
    if (!result.success) {
      socket.emit('join-error', { message: result.message });
      return;
    }
    socket.join(roomId);
    const room = result.room;
    socket.emit('room-joined', { roomId, color: 'black' });
    io.to(roomId).emit('player-joined', { roomId });

    // Start game
    const gameState = roomManager.startGame(roomId);
    io.to(roomId).emit('game-started', { gameState });
  });

  socket.on('roll-dice', ({ roomId }) => {
    const result = roomManager.rollDice(roomId, socket.id);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('dice-rolled', { dice: result.dice, player: result.player });
  });

  socket.on('make-move', ({ roomId, move }) => {
    const result = roomManager.applyMove(roomId, socket.id, move);
    if (!result.success) {
      socket.emit('action-error', { message: result.message });
      return;
    }
    io.to(roomId).emit('move-made', { gameState: result.gameState, move });

    if (result.gameOver) {
      io.to(roomId).emit('game-over', {
        winner: result.winner,
        type: result.gameType
      });
      roomManager.finishRoom(roomId);
    } else if (result.turnChanged) {
      io.to(roomId).emit('turn-changed', { currentPlayer: result.gameState.currentPlayer });
    }
  });

  socket.on('resign', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const winner = player.color === 'white' ? 'black' : 'white';
    io.to(roomId).emit('game-over', { winner, type: 'resign' });
    roomManager.finishRoom(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const roomId = roomManager.findPlayerRoom(socket.id);
    if (roomId) {
      io.to(roomId).emit('player-left', { socketId: socket.id });
      roomManager.removePlayer(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
