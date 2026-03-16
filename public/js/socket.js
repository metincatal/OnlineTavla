// Socket.io Client for Online Multiplayer

class OnlineGame {
  constructor(gameController) {
    this.game = gameController;
    this.socket = null;
    this.roomId = null;
    this.myColor = null;
    this.connected = false;
    this._connectPromise = null;
    this._reconnecting = false;
  }

  connect() {
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = new Promise((resolve, reject) => {
      if (typeof io === 'undefined' || window._socketUnavailable) {
        this._connectPromise = null;
        reject(new Error('Socket.io kullanılamıyor'));
        return;
      }

      this.socket = io(typeof SERVER_URL !== 'undefined' ? SERVER_URL : undefined, {
        transports: ['websocket', 'polling'],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      });

      const connectTimeout = setTimeout(() => {
        if (!this.connected) {
          this._connectPromise = null;
          reject(new Error('timeout'));
        }
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this.connected = true;
        this._reconnecting = false;
        console.log('Connected to server');

        // Send nickname
        const nick = APP_SETTINGS.nickname || 'Anonim';
        this.socket.emit('set-nickname', { nickname: nick });

        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        if (!this.connected) {
          clearTimeout(connectTimeout);
          this._connectPromise = null;
          reject(err);
        }
      });

      this.setupListeners();
    });

    return this._connectPromise;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this._connectPromise = null;
    this.roomId = null;
    this.myColor = null;
  }

  setupListeners() {
    this.socket.on('disconnect', () => {
      this.connected = false;
      this._reconnecting = true;
      this.game.showGlobalNotification('Sunucu bağlantısı kesildi...', 'warning');
    });

    this.socket.on('reconnect', () => {
      this.connected = true;
      this._reconnecting = false;
      this.game.showGlobalNotification('Bağlantı yeniden kuruldu!', 'success', 2000);
      const nick = APP_SETTINGS.nickname || 'Anonim';
      this.socket.emit('set-nickname', { nickname: nick });
    });

    // ─── Online Count ─────────────────────────────────────────
    this.socket.on('online-count', ({ count }) => {
      this.game.updateOnlineCount(count);
    });

    // ─── Lobby ────────────────────────────────────────────────
    this.socket.on('lobby-data', ({ rooms }) => {
      this.game.updateLobbyRooms(rooms);
    });

    this.socket.on('lobby-update', ({ rooms }) => {
      this.game.updateLobbyRooms(rooms);
    });

    // ─── Room events ──────────────────────────────────────────
    this.socket.on('room-created', ({ roomId, color, roomInfo }) => {
      this.roomId = roomId;
      this.myColor = color;
      this.game.showWaitingRoom(roomInfo);
    });

    this.socket.on('room-joined', ({ roomId, color, roomInfo }) => {
      this.roomId = roomId;
      this.myColor = color;
      this.game.showWaitingRoom(roomInfo);
    });

    this.socket.on('room-update', (roomInfo) => {
      this.game.updateWaitingRoom(roomInfo);
    });

    this.socket.on('join-error', ({ message }) => {
      this.game.showGlobalNotification(message, 'error', 3000);
    });

    this.socket.on('join-requested', ({ roomId }) => {
      this.game.showGlobalNotification('Katılım isteği gönderildi. Host onayı bekleniyor...', 'info', 3000);
    });

    this.socket.on('join-request', ({ roomId, requesterId, nickname }) => {
      this.game.showJoinRequest(roomId, requesterId, nickname);
    });

    this.socket.on('join-rejected', ({ message }) => {
      this.game.showGlobalNotification(message, 'error', 3000);
    });

    this.socket.on('player-joined', ({ roomId, nickname }) => {
      // Notification handled by room-update
    });

    this.socket.on('room-left', () => {
      this.roomId = null;
      this.myColor = null;
    });

    // ─── Game events ──────────────────────────────────────────
    this.socket.on('game-started', ({ gameState, roomInfo }) => {
      this.game.loadOnlineState(gameState, this.myColor, roomInfo);
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

    this.socket.on('game-over', ({ winner, type, cubeValue, betAmount }) => {
      this.game.onlineGameOver(winner, type, cubeValue, betAmount);
    });

    this.socket.on('player-left', () => {
      if (this.game.state && this.game.state.gameMode === 'online' &&
          this.game.state.phase !== 'gameover') {
        this.game.showGlobalNotification('Rakip oyundan ayrıldı.', 'warning', 3000);
      }
    });

    this.socket.on('action-error', ({ message }) => {
      console.error('Action error:', message);
    });

    // ─── Doubling Cube events ─────────────────────────────────
    this.socket.on('double-offered', ({ cube }) => {
      this.game.onDoubleOffered(cube);
    });

    this.socket.on('double-accepted', ({ cube }) => {
      this.game.onDoubleAccepted(cube);
    });

    this.socket.on('double-declined', ({ winner }) => {
      // game-over event will follow
    });

    // ─── Notifications ────────────────────────────────────────
    this.socket.on('room-notification', ({ type, message, roomId }) => {
      this.game.showGlobalNotification(message, 'info', 5000, roomId);
    });
  }

  // ─── Actions ──────────────────────────────────────────────────

  async connectToServer() {
    return this.connect();
  }

  fetchLobby() {
    if (!this.connected) return;
    this.socket.emit('get-lobby');
  }

  fetchOnlineCount() {
    if (!this.connected) return;
    this.socket.emit('get-online-count');
  }

  createRoomWithOptions(options) {
    if (!this.connected) return;
    this.socket.emit('create-room', options);
  }

  joinRoom(roomId) {
    if (!this.connected) return;
    this.socket.emit('join-room', { roomId });
  }

  requestJoinRoom(roomId) {
    if (!this.connected) return;
    this.socket.emit('request-join', { roomId });
  }

  approveJoin(roomId, requesterId) {
    if (!this.connected) return;
    this.socket.emit('approve-join', { roomId, requesterId });
  }

  rejectJoin(roomId, requesterId) {
    if (!this.connected) return;
    this.socket.emit('reject-join', { roomId, requesterId });
  }

  setReady(ready) {
    if (!this.roomId) return;
    this.socket.emit('set-ready', { roomId: this.roomId, ready });
  }

  leaveRoom() {
    if (!this.connected) return;
    this.socket.emit('leave-room');
    this.roomId = null;
    this.myColor = null;
  }

  rollDice() {
    if (!this.roomId) return;
    this.socket.emit('roll-dice', { roomId: this.roomId });
  }

  makeMove(move) {
    if (!this.roomId) return;
    this.socket.emit('make-move', { roomId: this.roomId, move });
  }

  offerDouble() {
    if (!this.roomId) return;
    this.socket.emit('offer-double', { roomId: this.roomId });
  }

  respondToDouble(accept) {
    if (!this.roomId) return;
    this.socket.emit('respond-double', { roomId: this.roomId, accept });
  }

  resign() {
    if (!this.roomId) return;
    this.socket.emit('resign', { roomId: this.roomId });
  }

  isMyTurn(currentPlayer) {
    return currentPlayer === this.myColor;
  }
}
