// Server-side Room Manager for Online Multiplayer

const INITIAL_BOARD_SERVER = [
  0, 2, 0, 0, 0, 0, -5, 0, -3, 0, 0, 0, 5,
  -5, 0, 0, 0, 3, 0, 5, 0, 0, 0, 0, -2, 0
];

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function rollDiceServer() {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

function expandDiceServer(dice) {
  if (dice[0] === dice[1]) {
    return [dice[0], dice[0], dice[0], dice[0]];
  }
  return [...dice];
}

function canLandServer(board, isWhite, point) {
  if (point < 1 || point > 24) return false;
  const val = board[point];
  return isWhite ? val >= -1 : val <= 1;
}

function isBearingOffServer(board, isWhite) {
  if (isWhite) {
    if (board[0] > 0) return false;
    for (let i = 1; i <= 18; i++) if (board[i] > 0) return false;
    return true;
  } else {
    if (board[25] < 0) return false;
    for (let i = 7; i <= 24; i++) if (board[i] < 0) return false;
    return true;
  }
}

function isHighestPointServer(board, isWhite, point) {
  if (isWhite) {
    for (let i = 24; i >= 19; i--) {
      if (board[i] > 0) return i === point;
    }
  } else {
    for (let i = 6; i >= 1; i--) {
      if (board[i] < 0) return i === point;
    }
  }
  return false;
}

function generateValidMovesServer(board, isWhite, remainingDice) {
  const barIndex = isWhite ? 0 : 25;
  const hasBar = board[barIndex] !== 0;
  const uniqueDice = [...new Set(remainingDice)];
  let allMoves = [];

  for (const die of uniqueDice) {
    if (hasBar) {
      const entryPoint = isWhite ? die : 25 - die;
      if (canLandServer(board, isWhite, entryPoint)) {
        allMoves.push({ from: barIndex, to: entryPoint, die });
      }
      continue;
    }

    const canBearOff = isBearingOffServer(board, isWhite);

    for (let i = 1; i <= 24; i++) {
      const hasPiece = isWhite ? board[i] > 0 : board[i] < 0;
      if (!hasPiece) continue;

      if (isWhite) {
        const target = i + die;
        if (target <= 24 && canLandServer(board, true, target)) {
          allMoves.push({ from: i, to: target, die });
        } else if (target >= 25 && canBearOff) {
          if (target === 25 || isHighestPointServer(board, true, i)) {
            allMoves.push({ from: i, to: 25, die });
          }
        }
      } else {
        const target = i - die;
        if (target >= 1 && canLandServer(board, false, target)) {
          allMoves.push({ from: i, to: target, die });
        } else if (target <= 0 && canBearOff) {
          if (target === 0 || isHighestPointServer(board, false, i)) {
            allMoves.push({ from: i, to: 0, die });
          }
        }
      }
    }
  }

  const seen = new Set();
  return allMoves.filter(m => {
    const key = `${m.from}-${m.to}-${m.die}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyMoveServer(board, move, isWhite) {
  const newBoard = [...board];
  const { from, to } = move;

  if (isWhite) newBoard[from]--;
  else newBoard[from]++;

  if (isWhite && to === 25) return newBoard;
  if (!isWhite && to === 0) return newBoard;

  if (isWhite && newBoard[to] === -1) {
    newBoard[to] = 0;
    newBoard[25]--;
  } else if (!isWhite && newBoard[to] === 1) {
    newBoard[to] = 0;
    newBoard[0]++;
  }

  if (isWhite) newBoard[to]++;
  else newBoard[to]--;

  return newBoard;
}

function isGameOverServer(board) {
  let white = 0, black = 0;
  for (let i = 0; i <= 25; i++) {
    if (board[i] > 0) white += board[i];
    if (board[i] < 0) black += Math.abs(board[i]);
  }
  return white === 0 || black === 0;
}

function getWinnerServer(board) {
  let white = 0, black = 0;
  for (let i = 0; i <= 25; i++) {
    if (board[i] > 0) white += board[i];
    if (board[i] < 0) black += Math.abs(board[i]);
  }
  if (white === 0) return 'white';
  if (black === 0) return 'black';
  return null;
}

function getGameTypeServer(board, winner) {
  if (winner === 'white') {
    let blackPieces = 0;
    for (let i = 0; i <= 25; i++) if (board[i] < 0) blackPieces += Math.abs(board[i]);
    if (blackPieces === 15) {
      // Check backgammon: any piece on bar or in white's home
      if (board[25] < 0) return 'backgammon';
      for (let i = 19; i <= 24; i++) if (board[i] < 0) return 'backgammon';
      return 'gammon';
    }
  } else {
    let whitePieces = 0;
    for (let i = 0; i <= 25; i++) if (board[i] > 0) whitePieces += board[i];
    if (whitePieces === 15) {
      if (board[0] > 0) return 'backgammon';
      for (let i = 1; i <= 6; i++) if (board[i] > 0) return 'backgammon';
      return 'gammon';
    }
  }
  return 'normal';
}

function getDiceAfterMoveServer(dice, usedDie) {
  const idx = dice.indexOf(usedDie);
  const remaining = [...dice];
  remaining.splice(idx, 1);
  return remaining;
}

class RoomManager {
  constructor() {
    this.rooms = {};
    this.playerRooms = {}; // socketId → roomId
  }

  createRoom(socketId, options = {}) {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (this.rooms[roomId]);

    const room = {
      id: roomId,
      name: (options.name || 'Oda ' + roomId).slice(0, 20),
      type: options.type || 'private',
      betAmount: options.betAmount || 100,
      players: [{
        id: socketId,
        color: 'white',
        nickname: options.nickname || 'Anonim',
        ready: false
      }],
      hostId: socketId,
      pendingRequests: [],
      gameState: null,
      status: 'waiting',
      doublingCube: { value: 1, owner: null, offered: false, offeredBy: null },
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    this.rooms[roomId] = room;
    this.playerRooms[socketId] = roomId;
    return room;
  }

  joinRoom(roomId, socketId, nickname) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    if (room.status !== 'waiting') return { success: false, message: 'Oda dolu veya oyun başlamış.' };
    if (room.players.length >= 2) return { success: false, message: 'Oda dolu.' };

    room.players.push({
      id: socketId,
      color: 'black',
      nickname: nickname || 'Anonim',
      ready: false
    });
    this.playerRooms[socketId] = roomId;
    room.lastActivity = Date.now();
    return { success: true, room };
  }

  requestJoin(roomId, socketId, nickname) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    if (room.type !== 'invite') return { success: false, message: 'Bu oda davetli modu değil.' };
    if (room.status !== 'waiting') return { success: false, message: 'Oda dolu veya oyun başlamış.' };
    if (room.players.length >= 2) return { success: false, message: 'Oda dolu.' };
    if (room.pendingRequests.some(r => r.id === socketId)) {
      return { success: false, message: 'İstek zaten gönderildi.' };
    }

    room.pendingRequests.push({ id: socketId, nickname: nickname || 'Anonim' });
    return { success: true, hostId: room.hostId };
  }

  approveJoin(roomId, hostSocketId, requesterSocketId) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    if (room.hostId !== hostSocketId) return { success: false, message: 'Sadece host onaylayabilir.' };
    if (room.players.length >= 2) return { success: false, message: 'Oda dolu.' };

    const reqIdx = room.pendingRequests.findIndex(r => r.id === requesterSocketId);
    if (reqIdx === -1) return { success: false, message: 'İstek bulunamadı.' };

    const req = room.pendingRequests.splice(reqIdx, 1)[0];
    room.players.push({
      id: requesterSocketId,
      color: 'black',
      nickname: req.nickname,
      ready: false
    });
    this.playerRooms[requesterSocketId] = roomId;
    room.lastActivity = Date.now();
    return { success: true, room };
  }

  rejectJoin(roomId, hostSocketId, requesterSocketId) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    if (room.hostId !== hostSocketId) return { success: false, message: 'Sadece host reddedebilir.' };

    room.pendingRequests = room.pendingRequests.filter(r => r.id !== requesterSocketId);
    return { success: true };
  }

  setReady(roomId, socketId, ready) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, message: 'Oyuncu bulunamadı.' };

    player.ready = ready;
    room.lastActivity = Date.now();

    const allReady = room.players.length === 2 && room.players.every(p => p.ready);
    return { success: true, allReady, room };
  }

  leaveRoom(socketId) {
    const roomId = this.playerRooms[socketId];
    if (!roomId) return null;

    const room = this.rooms[roomId];
    if (!room) {
      delete this.playerRooms[socketId];
      return null;
    }

    // Remove from pending requests
    room.pendingRequests = room.pendingRequests.filter(r => r.id !== socketId);

    // Remove from players
    room.players = room.players.filter(p => p.id !== socketId);
    delete this.playerRooms[socketId];

    if (room.players.length === 0) {
      delete this.rooms[roomId];
      return { roomId, deleted: true };
    }

    // Transfer host if needed
    if (room.hostId === socketId) {
      room.hostId = room.players[0].id;
    }
    room.status = 'waiting';
    room.players.forEach(p => p.ready = false);
    return { roomId, deleted: false, room };
  }

  getOpenRooms() {
    return Object.values(this.rooms)
      .filter(r => (r.type === 'open' || r.type === 'invite') && r.status === 'waiting' && r.players.length < 2)
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        betAmount: r.betAmount,
        hostNickname: r.players[0] ? r.players[0].nickname : 'Anonim',
        playerCount: r.players.length
      }));
  }

  getRoomInfo(roomId) {
    const room = this.rooms[roomId];
    if (!room) return null;
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      betAmount: room.betAmount,
      status: room.status,
      players: room.players.map(p => ({
        nickname: p.nickname,
        color: p.color,
        ready: p.ready,
        isHost: p.id === room.hostId
      })),
      doublingCube: room.doublingCube
    };
  }

  startGame(roomId) {
    const room = this.rooms[roomId];
    if (!room) return null;

    let whiteRoll, blackRoll;
    do {
      whiteRoll = Math.floor(Math.random() * 6) + 1;
      blackRoll = Math.floor(Math.random() * 6) + 1;
    } while (whiteRoll === blackRoll);

    const firstPlayer = whiteRoll > blackRoll ? 'white' : 'black';
    const initialDice = firstPlayer === 'white' ? [whiteRoll, blackRoll] : [blackRoll, whiteRoll];

    room.gameState = {
      board: [...INITIAL_BOARD_SERVER],
      currentPlayer: firstPlayer,
      dice: initialDice,
      remainingDice: [...initialDice],
      phase: 'moving'
    };
    room.status = 'playing';
    room.doublingCube = { value: 1, owner: null, offered: false, offeredBy: null };
    room.lastActivity = Date.now();

    return room.gameState;
  }

  rollDice(roomId, socketId) {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'playing') return { success: false, message: 'Oyun aktif değil.' };

    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, message: 'Oyuncu bulunamadı.' };

    const gs = room.gameState;
    if (gs.currentPlayer !== player.color) return { success: false, message: 'Sıra sizde değil.' };
    if (gs.phase !== 'rolling') return { success: false, message: 'Zar atma sırası değil.' };

    const dice = rollDiceServer();
    const expanded = expandDiceServer(dice);
    gs.dice = expanded;
    gs.remainingDice = [...expanded];
    gs.phase = 'moving';
    room.lastActivity = Date.now();

    return { success: true, dice: expanded, player: player.color };
  }

  applyMove(roomId, socketId, move) {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'playing') return { success: false, message: 'Oyun aktif değil.' };

    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, message: 'Oyuncu bulunamadı.' };

    const gs = room.gameState;
    if (gs.currentPlayer !== player.color) return { success: false, message: 'Sıra sizde değil.' };
    if (gs.phase !== 'moving') return { success: false, message: 'Hamle sırası değil.' };

    const isWhite = player.color === 'white';

    const validMoves = generateValidMovesServer(gs.board, isWhite, gs.remainingDice);
    const isValid = validMoves.some(m => m.from === move.from && m.to === move.to && m.die === move.die);
    if (!isValid) return { success: false, message: 'Geçersiz hamle.' };

    gs.board = applyMoveServer(gs.board, move, isWhite);
    gs.remainingDice = getDiceAfterMoveServer(gs.remainingDice, move.die);
    room.lastActivity = Date.now();

    if (isGameOverServer(gs.board)) {
      const winner = getWinnerServer(gs.board);
      const gameType = getGameTypeServer(gs.board, winner);
      return { success: true, gameState: gs, gameOver: true, winner, gameType };
    }

    const remainingMoves = generateValidMovesServer(gs.board, isWhite, gs.remainingDice);
    if (gs.remainingDice.length === 0 || remainingMoves.length === 0) {
      gs.currentPlayer = gs.currentPlayer === 'white' ? 'black' : 'white';
      gs.dice = [];
      gs.remainingDice = [];
      gs.phase = 'rolling';
      return { success: true, gameState: gs, turnChanged: true };
    }

    return { success: true, gameState: gs };
  }

  // Doubling cube
  offerDouble(roomId, socketId) {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'playing') return { success: false, message: 'Oyun aktif değil.' };

    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, message: 'Oyuncu bulunamadı.' };

    const gs = room.gameState;
    const cube = room.doublingCube;

    if (gs.currentPlayer !== player.color) return { success: false, message: 'Sıra sizde değil.' };
    if (gs.phase !== 'rolling') return { success: false, message: 'Zar atmadan önce teklif edebilirsiniz.' };
    if (cube.offered) return { success: false, message: 'Zaten bir teklif var.' };
    if (cube.owner !== null && cube.owner !== player.color) {
      return { success: false, message: 'Küp size ait değil.' };
    }

    cube.offered = true;
    cube.offeredBy = player.color;
    room.lastActivity = Date.now();
    return { success: true, cube };
  }

  respondToDouble(roomId, socketId, accept) {
    const room = this.rooms[roomId];
    if (!room || room.status !== 'playing') return { success: false, message: 'Oyun aktif değil.' };

    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, message: 'Oyuncu bulunamadı.' };

    const cube = room.doublingCube;
    if (!cube.offered) return { success: false, message: 'Aktif teklif yok.' };
    if (cube.offeredBy === player.color) return { success: false, message: 'Kendi teklifinize yanıt veremezsiniz.' };

    cube.offered = false;
    room.lastActivity = Date.now();

    if (accept) {
      cube.value *= 2;
      cube.owner = player.color;
      cube.offeredBy = null;
      return { success: true, accepted: true, cube };
    } else {
      cube.offeredBy = null;
      const winner = cube.offeredBy === 'white' ? 'white' : player.color === 'white' ? 'black' : 'white';
      return { success: true, accepted: false, winner, cube };
    }
  }

  getRoom(roomId) {
    return this.rooms[roomId];
  }

  findPlayerRoom(socketId) {
    return this.playerRooms[socketId];
  }

  removePlayer(socketId) {
    return this.leaveRoom(socketId);
  }

  finishRoom(roomId) {
    const room = this.rooms[roomId];
    if (room) room.status = 'finished';
  }

  cleanupStaleRooms() {
    const now = Date.now();
    const WAITING_TIMEOUT = 10 * 60 * 1000; // 10 min
    const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 min

    const staleRooms = [];
    for (const [roomId, room] of Object.entries(this.rooms)) {
      const elapsed = now - room.lastActivity;
      if (room.status === 'waiting' && elapsed > WAITING_TIMEOUT) {
        staleRooms.push(roomId);
      } else if (room.status === 'playing' && elapsed > INACTIVITY_TIMEOUT) {
        staleRooms.push(roomId);
      } else if (room.status === 'finished') {
        staleRooms.push(roomId);
      }
    }

    for (const roomId of staleRooms) {
      const room = this.rooms[roomId];
      if (room) {
        for (const p of room.players) {
          delete this.playerRooms[p.id];
        }
        delete this.rooms[roomId];
      }
    }

    return staleRooms;
  }
}

module.exports = RoomManager;
