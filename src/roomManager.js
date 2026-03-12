// Server-side Room Manager for Online Multiplayer

// Import game logic (shared between client and server)
// In a real setup, use a shared module. Here we inline necessary functions.

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

// Inline move validation (simplified)
function canLandServer(board, isWhite, point) {
  if (point < 1 || point > 24) return false;
  const val = board[point];
  return isWhite ? val >= -1 : val <= 1;
}

// White moves 1→24 (home 19-24), Black moves 24→1 (home 1-6)
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
    // White home 19-24, highest = largest index
    for (let i = 24; i >= 19; i--) {
      if (board[i] > 0) return i === point;
    }
  } else {
    // Black home 1-6: "highest" = largest index (furthest from exit, must be used first for overshoot)
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
        // White moves 1→24
        const target = i + die;
        if (target <= 24 && canLandServer(board, true, target)) {
          allMoves.push({ from: i, to: target, die });
        } else if (target >= 25 && canBearOff) {
          if (target === 25 || isHighestPointServer(board, true, i)) {
            allMoves.push({ from: i, to: 25, die });
          }
        }
      } else {
        // Black moves 24→1
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

  // Deduplicate
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

  // White bears off to 25, Black bears off to 0
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

  createRoom(socketId) {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (this.rooms[roomId]);

    const room = {
      id: roomId,
      players: [{ id: socketId, color: 'white' }],
      gameState: null,
      status: 'waiting'
    };
    this.rooms[roomId] = room;
    this.playerRooms[socketId] = roomId;
    return room;
  }

  joinRoom(roomId, socketId) {
    const room = this.rooms[roomId];
    if (!room) return { success: false, message: 'Oda bulunamadı.' };
    if (room.status !== 'waiting') return { success: false, message: 'Oda dolu.' };
    if (room.players.length >= 2) return { success: false, message: 'Oda dolu.' };

    room.players.push({ id: socketId, color: 'black' });
    this.playerRooms[socketId] = roomId;
    room.status = 'playing';
    return { success: true, room };
  }

  startGame(roomId) {
    const room = this.rooms[roomId];
    if (!room) return null;

    // Initial roll to determine who goes first
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

    // Validate move server-side
    const validMoves = generateValidMovesServer(gs.board, isWhite, gs.remainingDice);
    const isValid = validMoves.some(m => m.from === move.from && m.to === move.to && m.die === move.die);
    if (!isValid) return { success: false, message: 'Geçersiz hamle.' };

    gs.board = applyMoveServer(gs.board, move, isWhite);
    gs.remainingDice = getDiceAfterMoveServer(gs.remainingDice, move.die);

    // Check game over
    if (isGameOverServer(gs.board)) {
      const winner = getWinnerServer(gs.board);
      return { success: true, gameState: gs, gameOver: true, winner };
    }

    // Check if turn ends
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

  getRoom(roomId) {
    return this.rooms[roomId];
  }

  findPlayerRoom(socketId) {
    return this.playerRooms[socketId];
  }

  removePlayer(socketId) {
    const roomId = this.playerRooms[socketId];
    if (roomId) {
      const room = this.rooms[roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socketId);
        if (room.players.length === 0) {
          delete this.rooms[roomId];
        } else {
          room.status = 'waiting';
        }
      }
      delete this.playerRooms[socketId];
    }
  }

  finishRoom(roomId) {
    const room = this.rooms[roomId];
    if (room) room.status = 'finished';
  }
}

module.exports = RoomManager;
