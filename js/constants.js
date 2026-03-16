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
const INNER_PAD = 7;
const BEAR_OFF_WIDTH = 54;
const POINT_WIDTH = 80;
const POINT_HEIGHT = 280;
const PIECE_RADIUS = 32;
const BAR_WIDTH = 50;
const TIP_ROUND = 7;

// Colors — natural warm palette
const COLORS = {
  boardBg:          '#B07848',   // warm caramel playing surface
  boardBorder:      '#4A2010',   // dark walnut frame
  pointLight:       '#DFC898',   // warm cream triangles
  pointDark:        '#8B3020',   // mahogany/rust triangles
  barBg:            '#3A1808',   // very dark walnut bar
  whitePiece:       '#F2EDE0',   // warm ivory
  whitePieceBorder: '#D4C4A4',
  blackPiece:       '#1A1208',   // very dark walnut
  blackPieceBorder: '#3A2416',
  validMove:        'rgba(50,130,60,0.55)',
  selectedPiece:    'rgba(175,140,20,0.8)',
  hitIndicator:     'rgba(195,55,30,0.7)',
  diceWhite:        '#F5F0E8',
  diceBlack:        '#1A1208',
  diceDot:          '#2C1A0E',
  diceDotWhite:     '#D4C4A4',
  textLight:        '#F2EDE4',
  textDark:         '#2C1A0E'
};

// App settings — persisted in localStorage
const APP_SETTINGS = {
  get vurkac() { return localStorage.getItem('app_vurkac') !== 'false'; },
  set vurkac(v) { localStorage.setItem('app_vurkac', String(v)); },
  get sound() { return localStorage.getItem('app_sound') !== 'false'; },
  set sound(v) { localStorage.setItem('app_sound', String(v)); }
};
window.APP_SETTINGS = APP_SETTINGS;

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
