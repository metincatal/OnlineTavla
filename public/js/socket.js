// Socket.io Client for Online Multiplayer (Phase 3)

class OnlineGame {
  constructor(gameController) {
    this.game = gameController;
    this.socket = null;
    this.roomId = null;
    this.myColor = null;
    this.connected = false;
  }

  connect() {
    if (typeof io === 'undefined' || window._socketUnavailable) {
      alert('Çevrimiçi mod bu ortamda kullanılamıyor.');
      return;
    }
    this.socket = io();
    this.setupListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  setupListeners() {
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.showMessage('Sunucu bağlantısı kesildi.');
    });

    this.socket.on('room-created', ({ roomId, color }) => {
      this.roomId = roomId;
      this.myColor = color;
      this.showMessage(`Oda oluşturuldu: ${roomId}. Rakip bekleniyor...`);
      document.getElementById('room-code-display').textContent = roomId;
      document.getElementById('room-code-section').style.display = 'block';
    });

    this.socket.on('room-joined', ({ roomId, color }) => {
      this.roomId = roomId;
      this.myColor = color;
    });

    this.socket.on('join-error', ({ message }) => {
      this.showMessage(`Hata: ${message}`);
    });

    this.socket.on('player-joined', () => {
      this.showMessage('Rakip katıldı! Oyun başlıyor...');
    });

    this.socket.on('game-started', ({ gameState }) => {
      this.game.loadOnlineState(gameState, this.myColor);
      document.getElementById('menu-screen').style.display = 'none';
      document.getElementById('game-screen').style.display = 'block';
    });

    this.socket.on('dice-rolled', ({ dice, player }) => {
      this.game.onlineRollReceived(dice, player);
    });

    this.socket.on('move-made', ({ gameState, move }) => {
      this.game.onlineMoveReceived(gameState, move);
    });

    this.socket.on('turn-changed', ({ currentPlayer }) => {
      this.game.onlineTurnChanged(currentPlayer);
    });

    this.socket.on('game-over', ({ winner, type }) => {
      this.game.onlineGameOver(winner, type);
    });

    this.socket.on('player-left', () => {
      this.showMessage('Rakip oyundan ayrıldı. Oyun bitti.');
      this.game.onlinePlayerLeft();
    });

    this.socket.on('action-error', ({ message }) => {
      console.error('Action error:', message);
    });
  }

  createRoom() {
    if (!this.connected) this.connect();
    this.socket.emit('create-room');
  }

  joinRoom(roomId) {
    if (!this.connected) this.connect();
    this.socket.emit('join-room', { roomId });
  }

  rollDice() {
    if (!this.roomId) return;
    this.socket.emit('roll-dice', { roomId: this.roomId });
  }

  makeMove(move) {
    if (!this.roomId) return;
    this.socket.emit('make-move', { roomId: this.roomId, move });
  }

  resign() {
    if (!this.roomId) return;
    this.socket.emit('resign', { roomId: this.roomId });
  }

  showMessage(msg) {
    const el = document.getElementById('online-status-message');
    if (el) el.textContent = msg;
  }

  isMyTurn(currentPlayer) {
    return currentPlayer === this.myColor;
  }
}
