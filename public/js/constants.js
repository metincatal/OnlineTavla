// Board initial state
// board[i] > 0 → white pieces count, board[i] < 0 → black pieces count
// board[0] = white bar, board[25] = black bar
// White moves from point 24→1, Black moves from point 1→24
const INITIAL_BOARD = [
  0,   // index 0: white bar
  2,   // point 1
  0,   // point 2
  0,   // point 3
  0,   // point 4
  0,   // point 5
  -5,  // point 6
  0,   // point 7
  -3,  // point 8
  0,   // point 9
  0,   // point 10
  0,   // point 11
  5,   // point 12
  -5,  // point 13
  0,   // point 14
  0,   // point 15
  0,   // point 16
  3,   // point 17
  0,   // point 18
  5,   // point 19
  0,   // point 20
  0,   // point 21
  0,   // point 22
  0,   // point 23
  -2,  // point 24
  0    // index 25: black bar
];

// SVG dimensions
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 750;
const BOARD_MARGIN = 30;
const POINT_WIDTH = 80;
const POINT_HEIGHT = 280;
const PIECE_RADIUS = 32;
const BAR_WIDTH = 80;

// Colors
const COLORS = {
  boardBg: '#6B3A2A',
  boardBorder: '#4A2418',
  pointLight: '#D4A96A',
  pointDark: '#C0392B',
  barBg: '#5A3020',
  whitePiece: '#F5F5F5',
  whitePieceBorder: '#CCCCCC',
  blackPiece: '#1A1A1A',
  blackPieceBorder: '#444444',
  validMove: 'rgba(39, 174, 96, 0.6)',
  selectedPiece: 'rgba(241, 196, 15, 0.8)',
  hitIndicator: 'rgba(231, 76, 60, 0.7)',
  diceWhite: '#FAFAFA',
  diceBlack: '#222222',
  diceDot: '#333333',
  diceDotWhite: '#DDDDDD',
  textLight: '#F5F5F5',
  textDark: '#1A1A1A'
};

// Game constants
const PLAYERS = {
  WHITE: 'white',
  BLACK: 'black'
};

const PHASES = {
  ROLLING: 'rolling',
  MOVING: 'moving',
  GAMEOVER: 'gameover',
  INITIAL_ROLL: 'initial_roll'
};

const GAME_MODES = {
  LOCAL: 'local',
  AI: 'ai',
  ONLINE: 'online'
};

const AI_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// White home board: points 1-6, Black home board: points 19-24
const WHITE_HOME_START = 1;
const WHITE_HOME_END = 6;
const BLACK_HOME_START = 19;
const BLACK_HOME_END = 24;
const TOTAL_PIECES = 15;
