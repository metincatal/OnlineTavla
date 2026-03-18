// Firebase Realtime Database Client for Online Multiplayer

class OnlineGame {
  constructor(gameController) {
    this.game = gameController;
    this.db = null;
    this.roomId = null;
    this.myColor = null;
    this.connected = false;
    this._connectPromise = null;
    this._oderId = null;
    this._listeners = [];       // active Firebase listeners to unsubscribe
    this._moveSeq = 0;          // sequence counter for moves
    this._lastProcessedSeq = 0; // prevent duplicate move processing
    this._isHost = false;
    this._presenceRef = null;
    this._disconnectRefs = [];  // onDisconnect refs to cancel on clean leave
    this._serverTimeOffset = 0;
    this._writeQueue = Promise.resolve();
  }

  // ─── OderId (persistent player identity) ───────────────────────

  _getOderId() {
    if (this._oderId) return this._oderId;
    let id = localStorage.getItem('tavla_oderId');
    if (!id) {
      id = 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('tavla_oderId', id);
    }
    this._oderId = id;
    return id;
  }

  // ─── Room code generation ──────────────────────────────────────

  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ─── Connect ───────────────────────────────────────────────────

  connect() {
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = new Promise((resolve, reject) => {
      try {
        if (typeof firebase === 'undefined' || !firebase.database) {
          this._connectPromise = null;
          reject(new Error('Firebase kullanılamıyor'));
          return;
        }

        this.db = firebaseDB;
        const oderId = this._getOderId();
        const nickname = APP_SETTINGS.nickname || 'Anonim';

        // Set presence
        this._presenceRef = this.db.ref('_presence/' + oderId);
        this._presenceRef.set({ nickname: nickname, timestamp: firebase.database.ServerValue.TIMESTAMP });
        this._presenceRef.onDisconnect().remove();

        // Listen for connection state
        const connRef = this.db.ref('.info/connected');
        const connListener = connRef.on('value', (snap) => {
          if (snap.val() === true) {
            if (!this.connected) {
              this.connected = true;
              // Re-set presence on reconnect
              this._presenceRef.set({ nickname: nickname, timestamp: firebase.database.ServerValue.TIMESTAMP });
              this._presenceRef.onDisconnect().remove();
            }
          } else {
            if (this.connected) {
              this.connected = false;
              this.game.showGlobalNotification('Bağlantı kesildi...', 'warning');
            }
          }
        });
        this._listeners.push({ ref: connRef, event: 'value', fn: connListener });

        this.connected = true;
        console.log('Connected to Firebase');

        // Start listening to online count
        this._listenOnlineCount();

        // Track server time offset for timer sync
        const offsetRef = this.db.ref('.info/serverTimeOffset');
        const offsetListener = offsetRef.on('value', snap => {
          this._serverTimeOffset = snap.val() || 0;
        });
        this._listeners.push({ ref: offsetRef, event: 'value', fn: offsetListener });

        resolve();
      } catch (err) {
        this._connectPromise = null;
        reject(err);
      }
    });

    return this._connectPromise;
  }

  async connectToServer() {
    return this.connect();
  }

  disconnect() {
    this._cleanupListeners();
    if (this._presenceRef) {
      this._presenceRef.remove().catch(() => {});
      this._presenceRef = null;
    }
    this.connected = false;
    this._connectPromise = null;
    this.roomId = null;
    this.myColor = null;
    this._isHost = false;
    this._moveSeq = 0;
    this._lastProcessedSeq = 0;
  }

  // ─── Listener management ───────────────────────────────────────

  _addListener(dbRef, eventType, callback) {
    const fn = dbRef.on(eventType, callback);
    this._listeners.push({ ref: dbRef, event: eventType, fn: fn });
    return fn;
  }

  _cleanupListeners() {
    for (const l of this._listeners) {
      l.ref.off(l.event, l.fn);
    }
    this._listeners = [];
    // Cancel onDisconnect handlers
    for (const d of this._disconnectRefs) {
      d.cancel().catch(() => {});
    }
    this._disconnectRefs = [];
  }

  _cleanupRoomListeners() {
    // Remove room-specific listeners but keep presence/connection/online-count
    const kept = [];
    for (const l of this._listeners) {
      const path = l.ref.toString();
      if (path.includes('/rooms/') || path.includes('/_index/')) {
        l.ref.off(l.event, l.fn);
      } else {
        kept.push(l);
      }
    }
    this._listeners = kept;
    for (const d of this._disconnectRefs) {
      d.cancel().catch(() => {});
    }
    this._disconnectRefs = [];
  }

  // ─── Online Count ──────────────────────────────────────────────

  _listenOnlineCount() {
    const presRef = this.db.ref('_presence');
    this._addListener(presRef, 'value', (snap) => {
      const data = snap.val();
      const count = data ? Object.keys(data).length : 0;
      this.game.updateOnlineCount(count);
    });
  }

  fetchOnlineCount() {
    // Already listening via _listenOnlineCount, but force a read
    if (!this.connected) return;
    this.db.ref('_presence').once('value').then((snap) => {
      const data = snap.val();
      const count = data ? Object.keys(data).length : 0;
      this.game.updateOnlineCount(count);
    }).catch(() => {});
  }

  // ─── Lobby ─────────────────────────────────────────────────────

  fetchLobby() {
    if (!this.connected) return;
    // Start listening to index for lobby updates
    const indexRef = this.db.ref('_index');

    // Remove old lobby listener if exists
    for (let i = this._listeners.length - 1; i >= 0; i--) {
      const path = this._listeners[i].ref.toString();
      if (path.includes('/_index')) {
        this._listeners[i].ref.off(this._listeners[i].event, this._listeners[i].fn);
        this._listeners.splice(i, 1);
      }
    }

    this._addListener(indexRef, 'value', (snap) => {
      const raw = snap.val() || {};
      const rooms = [];
      for (const [code, entry] of Object.entries(raw)) {
        if (!entry || !entry.hostNickname) continue;
        rooms.push({
          id: code,
          name: entry.name || 'Oda',
          type: entry.type || 'open',
          betAmount: entry.betAmount || 100,
          hostNickname: entry.hostNickname,
          playerCount: entry.playerCount || 1
        });
      }
      this.game.updateLobbyRooms(rooms);
    });
  }

  // ─── Create Room ───────────────────────────────────────────────

  async createRoomWithOptions(options) {
    if (!this.connected) return;

    // Leave existing room first
    if (this.roomId) {
      await this._doLeaveRoom();
    }

    const oderId = this._getOderId();
    const nickname = APP_SETTINGS.nickname || 'Anonim';

    // Generate unique room code
    let roomCode = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      roomCode = this._generateRoomCode();
      const snap = await this.db.ref('rooms/' + roomCode).once('value');
      if (!snap.exists()) break;
    }

    this.roomId = roomCode;
    this.myColor = 'white';
    this._isHost = true;
    this._moveSeq = 0;
    this._lastProcessedSeq = 0;

    const roomData = {
      info: {
        name: (options.name || 'Oda').slice(0, 20),
        type: options.type || 'private',
        betAmount: options.betAmount || 100,
        vurkac: options.vurkac !== false,
        hostId: oderId,
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      }
    };

    // Write room
    await this.db.ref('rooms/' + roomCode).set(roomData);

    // Write player entry
    await this.db.ref('rooms/' + roomCode + '/players/' + oderId).set({
      oderId: oderId,
      nickname: nickname,
      color: 'white',
      ready: false,
      connected: true,
      coins: APP_SETTINGS.coins
    });

    // onDisconnect: mark player disconnected
    const disconnRef = this.db.ref('rooms/' + roomCode + '/players/' + oderId + '/connected');
    disconnRef.onDisconnect().set(false);
    this._disconnectRefs.push(disconnRef.onDisconnect());

    // Index for lobby (only for open/invite rooms)
    if (options.type !== 'private') {
      await this.db.ref('_index/' + roomCode).set({
        name: (options.name || 'Oda').slice(0, 20),
        type: options.type,
        betAmount: options.betAmount || 100,
        hostNickname: nickname,
        playerCount: 1,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      const idxDisconn = this.db.ref('_index/' + roomCode);
      idxDisconn.onDisconnect().remove();
      this._disconnectRefs.push(idxDisconn.onDisconnect());
    }

    // Build room info for UI
    const roomInfo = this._buildRoomInfo(roomCode, {
      name: options.name || 'Oda',
      type: options.type || 'private',
      betAmount: options.betAmount || 100,
      status: 'waiting'
    }, [{
      nickname: nickname,
      color: 'white',
      ready: false,
      isHost: true
    }]);

    this.game.showWaitingRoom(roomInfo);

    // Start room listeners
    this._setupRoomListeners(roomCode);

    // Broadcast notification
    if (options.type !== 'private') {
      this.game.showGlobalNotification('Oda oluşturuldu: ' + roomCode, 'success', 3000);
    }
  }

  // ─── Join Room ─────────────────────────────────────────────────

  async joinRoom(roomId) {
    if (!this.connected) return;
    roomId = roomId.toUpperCase();

    try {
      const roomSnap = await this.db.ref('rooms/' + roomId + '/info').once('value');
      if (!roomSnap.exists()) {
        this.game.showGlobalNotification('Oda bulunamadı.', 'error', 3000);
        return;
      }

      const info = roomSnap.val();

      // Check if invite mode → redirect to requestJoin
      if (info.type === 'invite') {
        this.requestJoinRoom(roomId);
        return;
      }

      if (info.status !== 'waiting') {
        this.game.showGlobalNotification('Oda dolu veya oyun başlamış.', 'error', 3000);
        return;
      }

      // Check player count
      const playersSnap = await this.db.ref('rooms/' + roomId + '/players').once('value');
      const players = playersSnap.val() || {};
      const connectedCount = Object.values(players).filter(p => p.connected).length;
      if (connectedCount >= 2) {
        this.game.showGlobalNotification('Oda dolu.', 'error', 3000);
        return;
      }

      // Leave current room
      if (this.roomId) {
        await this._doLeaveRoom();
      }

      const oderId = this._getOderId();
      const nickname = APP_SETTINGS.nickname || 'Anonim';

      this.roomId = roomId;
      this.myColor = 'black';
      this._isHost = false;
      this._moveSeq = 0;
      this._lastProcessedSeq = 0;

      // Use transaction to prevent race conditions
      await this.db.ref('rooms/' + roomId + '/players/' + oderId).set({
        oderId: oderId,
        nickname: nickname,
        color: 'black',
        ready: false,
        connected: true,
        coins: APP_SETTINGS.coins
      });

      // onDisconnect
      const disconnRef = this.db.ref('rooms/' + roomId + '/players/' + oderId + '/connected');
      disconnRef.onDisconnect().set(false);
      this._disconnectRefs.push(disconnRef.onDisconnect());

      // Update index player count
      this.db.ref('_index/' + roomId + '/playerCount').set(connectedCount + 1).catch(() => {});

      // Get full room info for UI
      const fullInfo = await this._fetchRoomInfo(roomId);
      this.game.showWaitingRoom(fullInfo);

      // Start listeners
      this._setupRoomListeners(roomId);

    } catch (err) {
      console.error('Join room error:', err);
      this.game.showGlobalNotification('Odaya katılırken hata oluştu.', 'error', 3000);
    }
  }

  // ─── Request Join (invite mode) ────────────────────────────────

  async requestJoinRoom(roomId) {
    if (!this.connected) return;
    roomId = roomId.toUpperCase();

    try {
      const roomSnap = await this.db.ref('rooms/' + roomId + '/info').once('value');
      if (!roomSnap.exists()) {
        this.game.showGlobalNotification('Oda bulunamadı.', 'error', 3000);
        return;
      }

      const info = roomSnap.val();
      if (info.status !== 'waiting') {
        this.game.showGlobalNotification('Oda dolu veya oyun başlamış.', 'error', 3000);
        return;
      }

      const oderId = this._getOderId();
      const nickname = APP_SETTINGS.nickname || 'Anonim';

      // Write join request
      await this.db.ref('rooms/' + roomId + '/joinRequests/' + oderId).set({
        nickname: nickname,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });

      this.game.showGlobalNotification('Katılım isteği gönderildi. Host onayı bekleniyor...', 'info', 3000);

      // Listen for approval (player entry appearing)
      const approvalRef = this.db.ref('rooms/' + roomId + '/players/' + oderId);
      const approvalListener = approvalRef.on('value', async (snap) => {
        if (snap.exists()) {
          approvalRef.off('value', approvalListener);

          // We've been approved — join the room
          this.roomId = roomId;
          this.myColor = 'black';
          this._isHost = false;
          this._moveSeq = 0;
          this._lastProcessedSeq = 0;

          // Update connected state and onDisconnect
          await this.db.ref('rooms/' + roomId + '/players/' + oderId + '/connected').set(true);
          const disconnRef = this.db.ref('rooms/' + roomId + '/players/' + oderId + '/connected');
          disconnRef.onDisconnect().set(false);
          this._disconnectRefs.push(disconnRef.onDisconnect());

          const fullInfo = await this._fetchRoomInfo(roomId);
          this.game.showWaitingRoom(fullInfo);
          this._setupRoomListeners(roomId);
        }
      });

      // Listen for rejection (request removed without player added)
      const rejectionRef = this.db.ref('rooms/' + roomId + '/joinRequests/' + oderId);
      const rejectionListener = rejectionRef.on('value', (snap) => {
        if (!snap.exists()) {
          rejectionRef.off('value', rejectionListener);
          // Check if we were approved (player exists) or rejected
          this.db.ref('rooms/' + roomId + '/players/' + oderId).once('value').then(pSnap => {
            if (!pSnap.exists()) {
              this.game.showGlobalNotification('İsteğiniz reddedildi.', 'error', 3000);
            }
          });
        }
      });

    } catch (err) {
      console.error('Request join error:', err);
      this.game.showGlobalNotification('İstek gönderilirken hata oluştu.', 'error', 3000);
    }
  }

  // ─── Approve / Reject Join ─────────────────────────────────────

  async approveJoin(roomId, requesterId) {
    if (!this.connected) return;

    try {
      // Get request data
      const reqSnap = await this.db.ref('rooms/' + roomId + '/joinRequests/' + requesterId).once('value');
      if (!reqSnap.exists()) return;
      const reqData = reqSnap.val();

      // Add player to room
      await this.db.ref('rooms/' + roomId + '/players/' + requesterId).set({
        oderId: requesterId,
        nickname: reqData.nickname || 'Anonim',
        color: 'black',
        ready: false,
        connected: true
      });

      // Remove request
      await this.db.ref('rooms/' + roomId + '/joinRequests/' + requesterId).remove();

      // Update index
      this.db.ref('_index/' + roomId + '/playerCount').set(2).catch(() => {});

    } catch (err) {
      console.error('Approve join error:', err);
    }
  }

  async rejectJoin(roomId, requesterId) {
    if (!this.connected) return;
    try {
      await this.db.ref('rooms/' + roomId + '/joinRequests/' + requesterId).remove();
    } catch (err) {
      console.error('Reject join error:', err);
    }
  }

  // ─── Ready ─────────────────────────────────────────────────────

  async setReady(ready) {
    if (!this.roomId) return;
    const oderId = this._getOderId();

    try {
      await this.db.ref('rooms/' + this.roomId + '/players/' + oderId + '/ready').set(ready);
    } catch (err) {
      console.error('Set ready error:', err);
    }
  }

  // ─── Leave Room ────────────────────────────────────────────────

  async leaveRoom() {
    await this._doLeaveRoom();
    this.roomId = null;
    this.myColor = null;
    this._isHost = false;
    this._moveSeq = 0;
    this._lastProcessedSeq = 0;
  }

  async _doLeaveRoom() {
    if (!this.roomId) return;
    const roomId = this.roomId;
    const oderId = this._getOderId();

    this._cleanupRoomListeners();

    try {
      // Remove player
      await this.db.ref('rooms/' + roomId + '/players/' + oderId).remove();

      // Check remaining players
      const playersSnap = await this.db.ref('rooms/' + roomId + '/players').once('value');
      const players = playersSnap.val();

      if (!players || Object.keys(players).length === 0) {
        // Last player → delete room
        await this.db.ref('rooms/' + roomId).remove();
        await this.db.ref('_index/' + roomId).remove().catch(() => {});
      } else {
        // Transfer host if we were host
        if (this._isHost) {
          const remainingIds = Object.keys(players);
          await this.db.ref('rooms/' + roomId + '/info/hostId').set(remainingIds[0]);
        }
        // Update status back to waiting, reset ready states
        await this.db.ref('rooms/' + roomId + '/info/status').set('waiting');
        for (const pid of Object.keys(players)) {
          await this.db.ref('rooms/' + roomId + '/players/' + pid + '/ready').set(false);
        }
        // Update index
        const newCount = Object.keys(players).length;
        this.db.ref('_index/' + roomId + '/playerCount').set(newCount).catch(() => {});
      }
    } catch (err) {
      console.error('Leave room error:', err);
    }
  }

  // ─── Roll Dice ─────────────────────────────────────────────────

  async rollDice() {
    if (!this.roomId) return;
    const oderId = this._getOderId();

    try {
      // Verify it's our turn
      const gsSnap = await this.db.ref('rooms/' + this.roomId + '/gameState').once('value');
      const gs = gsSnap.val();
      if (!gs || gs.currentPlayer !== this.myColor || gs.phase !== 'rolling') return;

      // Generate dice client-side
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const expanded = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2];

      // Write to gameState
      await this.db.ref('rooms/' + this.roomId + '/gameState').update({
        dice: expanded,
        remainingDice: expanded,
        phase: 'moving'
      });

    } catch (err) {
      console.error('Roll dice error:', err);
    }
  }

  // ─── Make Move ─────────────────────────────────────────────────

  async makeMove(move, soundType) {
    if (!this.roomId) return;

    // Snapshot local board state (already applied by game.js)
    const board = [...this.game.state.board];
    const remaining = [...(this.game.state.remainingDice || [])];
    const roomId = this.roomId;

    this._moveSeq++;
    const seq = this._moveSeq;

    this._writeQueue = this._writeQueue.then(async () => {
      try {
        const updates = {
          'gameState/board': board,
          'gameState/remainingDice': remaining,
          'lastMove': {
            from: move.from,
            to: move.to,
            die: move.die,
            player: this.myColor,
            soundType: soundType || 'move',
            seq: seq,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          }
        };

        if (this._isGameOver(board)) {
          const winner = this._getWinner(board);
          const gameType = this._getGameType(board, winner);
          updates['gameState/gameOver'] = { winner, type: gameType };
        }

        await this.db.ref('rooms/' + roomId).update(updates);
      } catch (err) {
        console.error('Make move error:', err);
      }
    });
  }

  // ─── Undo Move (sync board state back to Firebase) ────────

  async undoToState(board, remainingDice) {
    if (!this.roomId) return;

    const boardCopy = [...board];
    const remainingCopy = [...remainingDice];
    const roomId = this.roomId;

    // Note: do NOT decrement _moveSeq here — the next move after undo must get a
    // fresh seq number that is strictly greater than _lastProcessedSeq on the opponent.

    // Queue after any pending makeMove to ensure undo overwrites the move
    this._writeQueue = this._writeQueue.then(async () => {
      try {
        await this.db.ref('rooms/' + roomId + '/gameState').update({
          board: boardCopy,
          remainingDice: remainingCopy
        });
      } catch (err) {
        console.error('Undo sync error:', err);
      }
    });
  }

  // ─── Confirm Turn ───────────────────────────────────────────────

  async confirmTurn(nextPlayer, timerUpdate) {
    if (!this.roomId) return;
    try {
      const updates = {
        'gameState/currentPlayer': nextPlayer,
        'gameState/dice': [],
        'gameState/remainingDice': [],
        'gameState/phase': 'rolling',
        'gameState/turnStartedAt': firebase.database.ServerValue.TIMESTAMP
      };
      if (timerUpdate) {
        updates['gameState/timer/' + timerUpdate.color + '/bonusRemaining'] = timerUpdate.bonusRemaining;
      }
      await this.db.ref('rooms/' + this.roomId).update(updates);
    } catch (err) {
      console.error('Confirm turn error:', err);
    }
  }

  // ─── Timeout Loss ─────────────────────────────────────────────

  async timeoutLoss(loser) {
    if (!this.roomId) return;
    const winner = loser === 'white' ? 'black' : 'white';
    try {
      await this.db.ref('rooms/' + this.roomId + '/gameState/gameOver').set({
        winner: winner,
        type: 'timeout'
      });
    } catch (err) {
      console.error('Timeout loss error:', err);
    }
  }

  // ─── Doubling Cube ─────────────────────────────────────────────

  async offerDouble() {
    if (!this.roomId) return false;

    try {
      const cubeSnap = await this.db.ref('rooms/' + this.roomId + '/doublingCube').once('value');
      const cube = cubeSnap.val() || { value: 1, owner: null, offered: false, offeredBy: null };

      if (cube.offered) return false;
      if (cube.owner != null && cube.owner !== this.myColor) return false;

      await this.db.ref('rooms/' + this.roomId + '/doublingCube').update({
        offered: true,
        offeredBy: this.myColor
      });
      return true;
    } catch (err) {
      console.error('Offer double error:', err);
      return false;
    }
  }

  async respondToDouble(accept) {
    if (!this.roomId) return;

    try {
      const cubeSnap = await this.db.ref('rooms/' + this.roomId + '/doublingCube').once('value');
      const cube = cubeSnap.val();
      if (!cube || !cube.offered) return;

      if (accept) {
        await this.db.ref('rooms/' + this.roomId + '/doublingCube').set({
          value: cube.value * 2,
          owner: this.myColor,
          offered: false,
          offeredBy: null
        });
      } else {
        // Decline → game over, offerer wins
        const winner = cube.offeredBy;
        await this.db.ref('rooms/' + this.roomId + '/doublingCube').update({
          offered: false,
          offeredBy: null
        });
        await this.db.ref('rooms/' + this.roomId + '/gameState/gameOver').set({
          winner: winner,
          type: 'double-decline'
        });
      }
    } catch (err) {
      console.error('Respond to double error:', err);
    }
  }

  // ─── Resign ────────────────────────────────────────────────────

  async resign() {
    if (!this.roomId) return;
    const winner = this.myColor === 'white' ? 'black' : 'white';

    try {
      const cubeSnap = await this.db.ref('rooms/' + this.roomId + '/doublingCube').once('value');
      const cube = cubeSnap.val() || { value: 1 };

      await this.db.ref('rooms/' + this.roomId + '/gameState/gameOver').set({
        winner: winner,
        type: 'resign'
      });
    } catch (err) {
      console.error('Resign error:', err);
    }
  }

  // ─── Rematch ──────────────────────────────────────────────────

  async requestRematch() {
    if (!this.roomId) return;
    const oderId = this._getOderId();
    try {
      await this.db.ref('rooms/' + this.roomId + '/rematch/' + oderId).set(true);
    } catch (err) {
      console.error('Rematch request error:', err);
    }
  }

  _listenRematch(roomCode) {
    const rematchRef = this.db.ref('rooms/' + roomCode + '/rematch');
    this._addListener(rematchRef, 'value', async (snap) => {
      const rematch = snap.val();
      if (!rematch) return;

      const oderId = this._getOderId();
      const entries = Object.keys(rematch);
      const opponentRequested = entries.some(id => id !== oderId && rematch[id] === true);
      const iRequested = rematch[oderId] === true;

      if (opponentRequested && !iRequested) {
        this.game.onRematchRequested();
      }

      if (opponentRequested && iRequested && entries.length >= 2) {
        // Both accepted — reset move counters
        this._moveSeq = 0;
        this._lastProcessedSeq = 0;

        // Host starts new game
        if (this._isHost) {
          // Get last winner for rematch starting player
          const gsSnap = await this.db.ref('rooms/' + roomCode + '/gameState').once('value').catch(() => null);
          const gs = gsSnap && gsSnap.val() ? gsSnap.val() : {};
          const lastWinner = (gs.gameOver && gs.gameOver.winner) || this.game._lastWinner || null;

          await this.db.ref('rooms/' + roomCode + '/rematch').remove();
          await this.db.ref('rooms/' + roomCode + '/gameState').remove();
          await this.db.ref('rooms/' + roomCode + '/lastMove').remove();

          const playersSnap = await this.db.ref('rooms/' + roomCode + '/players').once('value');
          const players = playersSnap.val() || {};
          const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value');
          const info = infoSnap.val() || {};

          // Update each player's stored coins
          const oderId = this._getOderId();
          await this.db.ref('rooms/' + roomCode + '/players/' + oderId + '/coins').set(APP_SETTINGS.coins);

          await this.db.ref('rooms/' + roomCode + '/info/status').set('playing');

          const playerList = [];
          for (const [pid, pdata] of Object.entries(players)) {
            playerList.push({
              oderId: pid,
              nickname: pdata.nickname || 'Anonim',
              color: pdata.color,
              ready: true,
              isHost: pid === info.hostId,
              coins: pid === oderId ? APP_SETTINGS.coins : (pdata.coins || 0)
            });
          }

          this._startGame(roomCode, playerList, lastWinner);
        } else {
          // Guest updates their own coins
          const oderId = this._getOderId();
          await this.db.ref('rooms/' + roomCode + '/players/' + oderId + '/coins').set(APP_SETTINGS.coins);
        }
      }
    });
  }

  // ─── Turn check ────────────────────────────────────────────────

  isMyTurn(currentPlayer) {
    return currentPlayer === this.myColor;
  }

  // ─── Room listeners ────────────────────────────────────────────

  _setupRoomListeners(roomCode) {
    this._cleanupRoomListeners();
    this._listenPlayers(roomCode);
    this._listenGameState(roomCode);
    this._listenDoublingCube(roomCode);
    this._listenJoinRequests(roomCode);
    this._listenLastMove(roomCode);
    this._listenRematch(roomCode);
  }

  _listenPlayers(roomCode) {
    const playersRef = this.db.ref('rooms/' + roomCode + '/players');
    this._addListener(playersRef, 'value', async (snap) => {
      const players = snap.val();
      if (!players) {
        // Room deleted or all players left
        return;
      }

      const oderId = this._getOderId();
      const playerList = [];
      let hostId = null;

      // Get hostId
      try {
        const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value');
        const info = infoSnap.val();
        if (info) hostId = info.hostId;
      } catch (e) {}

      for (const [pid, pdata] of Object.entries(players)) {
        playerList.push({
          oderId: pid,
          nickname: pdata.nickname || 'Anonim',
          color: pdata.color,
          ready: pdata.ready || false,
          isHost: pid === hostId,
          connected: pdata.connected !== false
        });
      }

      // Check if opponent disconnected during game
      const me = playerList.find(p => p.oderId === oderId);
      const opponent = playerList.find(p => p.oderId !== oderId);

      if (opponent && !opponent.connected && this.game.state &&
          this.game.state.gameMode === 'online' && this.game.state.phase !== 'gameover') {
        // Opponent disconnected during game → they lose
        const winner = me ? me.color : this.myColor;
        const cubeSnap = await this.db.ref('rooms/' + roomCode + '/doublingCube').once('value').catch(() => null);
        const cube = cubeSnap && cubeSnap.val() ? cubeSnap.val() : { value: 1 };
        const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value').catch(() => null);
        const info = infoSnap && infoSnap.val() ? infoSnap.val() : { betAmount: 0 };

        this.game.showGlobalNotification('Rakip bağlantısı kesildi.', 'warning', 3000);
        this.game.onlineGameOver(winner, 'disconnect', cube.value, info.betAmount);
        return;
      }

      // Update waiting room
      const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value').catch(() => null);
      const info = infoSnap && infoSnap.val() ? infoSnap.val() : {};

      if (info.status === 'waiting') {
        const roomInfo = this._buildRoomInfo(roomCode, info, playerList);
        this.game.updateWaitingRoom(roomInfo);
      }

      // Check all ready → start game (host only)
      if (this._isHost && playerList.length === 2 && playerList.every(p => p.ready)) {
        this._startGame(roomCode, playerList);
      }
    });
  }

  _listenGameState(roomCode) {
    const gsRef = this.db.ref('rooms/' + roomCode + '/gameState');
    this._gsFirstLoad = true;

    this._addListener(gsRef, 'value', async (snap) => {
      const gs = snap.val();
      if (!gs) {
        // gameState removed (e.g., rematch) — reset firstLoad
        this._gsFirstLoad = true;
        return;
      }

      // Handle game over
      if (gs.gameOver) {
        const cubeSnap = await this.db.ref('rooms/' + roomCode + '/doublingCube').once('value').catch(() => null);
        const cube = cubeSnap && cubeSnap.val() ? cubeSnap.val() : { value: 1 };
        const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value').catch(() => null);
        const info = infoSnap && infoSnap.val() ? infoSnap.val() : { betAmount: 0 };

        this.game.onlineGameOver(gs.gameOver.winner, gs.gameOver.type, cube.value, info.betAmount);

        // Mark room as finished
        this.db.ref('rooms/' + roomCode + '/info/status').set('finished').catch(() => {});
        this.db.ref('_index/' + roomCode).remove().catch(() => {});
        return;
      }

      // Game started — load initial state
      if (this._gsFirstLoad && gs.board) {
        this._gsFirstLoad = false;

        const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value').catch(() => null);
        const info = infoSnap && infoSnap.val() ? infoSnap.val() : {};
        const playersSnap = await this.db.ref('rooms/' + roomCode + '/players').once('value').catch(() => null);
        const players = playersSnap && playersSnap.val() ? playersSnap.val() : {};
        const hostId = info.hostId;

        const playerList = [];
        for (const [pid, pdata] of Object.entries(players)) {
          playerList.push({
            nickname: pdata.nickname || 'Anonim',
            color: pdata.color,
            ready: true,
            isHost: pid === hostId,
            coins: pdata.coins || 0
          });
        }

        const roomInfo = this._buildRoomInfo(roomCode, info, playerList);
        this.game.loadOnlineState(gs, this.myColor, roomInfo);

        // If phase is initial_roll, trigger initial roll animation on both clients
        if (gs.phase === 'initial_roll' && gs.whiteRoll && gs.blackRoll) {
          this.game.doOnlineInitialRoll(gs.whiteRoll, gs.blackRoll, gs.currentPlayer, gs.dice);
          // Host transitions phase to 'moving' after animation
          if (this._isHost) {
            setTimeout(() => {
              this.db.ref('rooms/' + roomCode + '/gameState/phase').set('moving').catch(() => {});
            }, 3200);
          }
        }
        return;
      }

      // Subsequent updates: check for dice roll or turn change from opponent
      if (!this._gsFirstLoad && this.game.state && this.game.state.gameMode === 'online') {
        // Phase transition from initial_roll to moving
        if (gs.phase === 'moving' && this.game.state.phase === 'initial_roll') {
          this.game.state.phase = PHASES.MOVING;
          this.game.updateValidMoves();
          this.game.updateUI();
          this.game.renderAll();
          return;
        }

        // Dice update — animate for both players
        if (gs.dice && gs.dice.length > 0 && gs.phase === 'moving') {
          const currentDice = this.game.state.dice || [];
          const newDice = gs.dice;
          if (JSON.stringify(currentDice) !== JSON.stringify(newDice)) {
            this.game.onlineRollReceived(newDice, gs.currentPlayer);
          }
        }

        // Turn change
        if (gs.currentPlayer !== this.game.state.currentPlayer) {
          this.game.onlineTurnChanged(gs.currentPlayer, gs.turnStartedAt, gs.timer);
        }

        // Board sync for opponent's undos (board changed while it's still their turn)
        if (gs.board && gs.currentPlayer !== this.myColor) {
          const remote = JSON.stringify(gs.board);
          const local = JSON.stringify(this.game.state.board);
          if (remote !== local) {
            this.game.state.board = gs.board;
            this.game.state.remainingDice = gs.remainingDice || [];
            this.game.renderAll();
          }
        }

        // Sync timer data from Firebase
        if (gs.turnStartedAt) {
          this.game._timerTurnStart = gs.turnStartedAt;
        }
        if (gs.timer) {
          this.game._timerBonusWhite = gs.timer.white ? gs.timer.white.bonusRemaining : 60000;
          this.game._timerBonusBlack = gs.timer.black ? gs.timer.black.bonusRemaining : 60000;
        }
      }
    });
  }

  _listenLastMove(roomCode) {
    const moveRef = this.db.ref('rooms/' + roomCode + '/lastMove');

    this._addListener(moveRef, 'value', (snap) => {
      const move = snap.val();
      if (!move) return;
      if (move.player === this.myColor) return; // Ignore our own moves
      if (move.seq <= this._lastProcessedSeq) return; // Already processed

      this._lastProcessedSeq = move.seq;

      // Play sound immediately (before async board read) to stay in sync with animation
      const soundType = move.soundType || 'move';
      if (window.sounds) sounds.play(soundType);

      // Get current game state for board update
      this.db.ref('rooms/' + roomCode + '/gameState').once('value').then((gsSnap) => {
        const gs = gsSnap.val();
        if (!gs) return;

        // Pass soundType=null so onlineMoveReceived doesn't play the sound again
        const moveData = { from: move.from, to: move.to, die: move.die, player: move.player, soundType: null };
        this.game.onlineMoveReceived(gs, moveData);
      }).catch(() => {});
    });
  }

  _listenDoublingCube(roomCode) {
    const cubeRef = this.db.ref('rooms/' + roomCode + '/doublingCube');
    let lastCubeState = null;

    this._addListener(cubeRef, 'value', (snap) => {
      const cube = snap.val();
      if (!cube) return;

      // Prevent re-firing for the same state
      const cubeKey = cube.offered + ':' + cube.offeredBy + ':' + cube.value;
      if (cubeKey === lastCubeState) return;
      lastCubeState = cubeKey;

      console.log('[DoublingCube] update:', JSON.stringify(cube), 'myColor:', this.myColor);

      if (cube.offered && cube.offeredBy !== this.myColor) {
        // Opponent offered double — show accept/decline modal
        this.game.onDoubleOffered(cube);
      } else if (cube.offered && cube.offeredBy === this.myColor) {
        // My own offer confirmed — update cube state (buttons already hidden)
        this.game._cubeState = { value: cube.value, owner: cube.owner || null, offered: true };
      } else if (!cube.offered && cube.value > 1) {
        // Double was accepted (or declined → gameOver handles that separately)
        this.game.onDoubleAccepted(cube);
      }
    });
  }

  _listenJoinRequests(roomCode) {
    if (!this._isHost) return;

    const reqRef = this.db.ref('rooms/' + roomCode + '/joinRequests');
    this._addListener(reqRef, 'child_added', (snap) => {
      const requesterId = snap.key;
      const data = snap.val();
      this.game.showJoinRequest(roomCode, requesterId, data.nickname || 'Anonim');
    });
  }

  // ─── Start Game (host generates initial roll) ──────────────────

  async _startGame(roomCode, playerList, startingPlayer) {
    try {
      let gameState;

      if (startingPlayer) {
        // Rematch: winner starts directly, no initial roll
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const expanded = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2];

        gameState = {
          board: [...INITIAL_BOARD],
          currentPlayer: startingPlayer,
          dice: expanded,
          remainingDice: [...expanded],
          phase: 'moving',
          turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
          timer: {
            white: { bonusRemaining: 60000 },
            black: { bonusRemaining: 60000 }
          }
        };
      } else {
        // First game: initial roll to determine who starts
        let whiteRoll, blackRoll;
        do {
          whiteRoll = Math.floor(Math.random() * 6) + 1;
          blackRoll = Math.floor(Math.random() * 6) + 1;
        } while (whiteRoll === blackRoll);

        const firstPlayer = whiteRoll > blackRoll ? 'white' : 'black';
        const initialDice = firstPlayer === 'white'
          ? [whiteRoll, blackRoll]
          : [blackRoll, whiteRoll];

        gameState = {
          board: [...INITIAL_BOARD],
          currentPlayer: firstPlayer,
          dice: initialDice,
          remainingDice: [...initialDice],
          phase: 'initial_roll',
          whiteRoll: whiteRoll,
          blackRoll: blackRoll,
          turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
          timer: {
            white: { bonusRemaining: 60000 },
            black: { bonusRemaining: 60000 }
          }
        };
      }

      await this.db.ref('rooms/' + roomCode).update({
        gameState: gameState,
        doublingCube: { value: 1, owner: null, offered: false, offeredBy: null },
        'info/status': 'playing'
      });

      // Remove from lobby index
      this.db.ref('_index/' + roomCode).remove().catch(() => {});

    } catch (err) {
      console.error('Start game error:', err);
    }
  }

  // ─── Helper: Build room info object ────────────────────────────

  _buildRoomInfo(roomCode, info, playerList) {
    return {
      id: roomCode,
      name: info.name || 'Oda',
      type: info.type || 'private',
      betAmount: info.betAmount || 100,
      vurkac: info.vurkac !== false,
      status: info.status || 'waiting',
      players: playerList.map(p => ({
        nickname: p.nickname,
        color: p.color,
        ready: p.ready,
        isHost: p.isHost,
        coins: p.coins || 0
      })),
      doublingCube: { value: 1, owner: null, offered: false, offeredBy: null }
    };
  }

  async _fetchRoomInfo(roomCode) {
    try {
      const infoSnap = await this.db.ref('rooms/' + roomCode + '/info').once('value');
      const info = infoSnap.val() || {};
      const playersSnap = await this.db.ref('rooms/' + roomCode + '/players').once('value');
      const players = playersSnap.val() || {};
      const hostId = info.hostId;

      const playerList = [];
      for (const [pid, pdata] of Object.entries(players)) {
        playerList.push({
          nickname: pdata.nickname || 'Anonim',
          color: pdata.color,
          ready: pdata.ready || false,
          isHost: pid === hostId
        });
      }

      return this._buildRoomInfo(roomCode, info, playerList);
    } catch (err) {
      return this._buildRoomInfo(roomCode, {}, []);
    }
  }

  // ─── Game logic helpers (client-side validation) ───────────────

  _applyMove(board, move, isWhite) {
    const newBoard = [...board];
    const { from, to } = move;

    if (isWhite) newBoard[from]--;
    else newBoard[from]++;

    // Bearing off
    if (isWhite && to === 25) return newBoard;
    if (!isWhite && to === 0) return newBoard;

    // Hit opponent
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

  _removeDie(dice, usedDie) {
    const idx = dice.indexOf(usedDie);
    if (idx === -1) return [...dice];
    const remaining = [...dice];
    remaining.splice(idx, 1);
    return remaining;
  }

  _isGameOver(board) {
    let white = 0, black = 0;
    for (let i = 0; i <= 25; i++) {
      if (board[i] > 0) white += board[i];
      if (board[i] < 0) black += Math.abs(board[i]);
    }
    return white === 0 || black === 0;
  }

  _getWinner(board) {
    let white = 0, black = 0;
    for (let i = 0; i <= 25; i++) {
      if (board[i] > 0) white += board[i];
      if (board[i] < 0) black += Math.abs(board[i]);
    }
    if (white === 0) return 'white';
    if (black === 0) return 'black';
    return null;
  }

  _getGameType(board, winner) {
    if (winner === 'white') {
      let blackPieces = 0;
      for (let i = 0; i <= 25; i++) if (board[i] < 0) blackPieces += Math.abs(board[i]);
      if (blackPieces === 15) {
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

  _hasValidMoves(board, isWhite, remainingDice) {
    // Quick check: are there any valid moves?
    const barIndex = isWhite ? 0 : 25;
    const hasBar = board[barIndex] !== 0;
    const uniqueDice = [...new Set(remainingDice)];

    for (const die of uniqueDice) {
      if (hasBar) {
        const entryPoint = isWhite ? die : 25 - die;
        if (this._canLand(board, isWhite, entryPoint)) return true;
        continue;
      }

      const canBearOff = this._isBearingOff(board, isWhite);

      for (let i = 1; i <= 24; i++) {
        const hasPiece = isWhite ? board[i] > 0 : board[i] < 0;
        if (!hasPiece) continue;

        if (isWhite) {
          const target = i + die;
          if (target <= 24 && this._canLand(board, true, target)) return true;
          if (target >= 25 && canBearOff) return true;
        } else {
          const target = i - die;
          if (target >= 1 && this._canLand(board, false, target)) return true;
          if (target <= 0 && canBearOff) return true;
        }
      }
    }
    return false;
  }

  _canLand(board, isWhite, point) {
    if (point < 1 || point > 24) return false;
    const val = board[point];
    return isWhite ? val >= -1 : val <= 1;
  }

  _isBearingOff(board, isWhite) {
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
}
