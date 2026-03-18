// Main Game Controller

class Game {
  constructor() {
    this.state = null;
    this.boardRenderer = null;
    this.diceManager = null;
    this.ai = null;
    this.onlineGame = null;
    this.bearOffCounts = { white: 0, black: 0 };
    this.moveHistory = [];          // undo stack
    this.confirmPending = false;    // waiting for player to confirm turn end
    this._hitModalPending = false;  // waiting for hit-confirm modal
    this._autoPlaying = false;      // forced move in progress
    this.playerNames = { white: 'Beyaz', black: 'Siyah' };
    this._aiPlayer = PLAYERS.BLACK;  // default: AI plays black
    this._schoolClosedShown = false;
    this._onlineRoomInfo = null;    // current online room info
    this._wrReadyState = false;     // waiting room ready toggle
    this._timerInterval = null;
    this._timerTurnStart = null;
    this._timerBonusWhite = 60000;
    this._timerBonusBlack = 60000;
    this._coinDeducted = false;
    this._cubeState = { value: 1, owner: null, offered: false };
    this._lastWinner = null;  // for rematch: winner starts next game
  }

  init() {
    this.boardRenderer = new Board('board-svg');
    this.boardRenderer.onPointClick = (point) => this.handlePointClick(point);
    this.boardRenderer.onPieceHover = (point) => this.handlePieceHover(point);
    this.boardRenderer.onDropMove   = (from, to) => this.handleDrop(from, to);
    this.diceManager = new DiceManager();
    this.updateCoinDisplay();
    this.showMenu();
  }

  // ─── Screen management ──────────────────────────────────────

  _hideAllScreens() {
    const screens = [
      'menu-screen', 'game-screen', 'gameover-screen',
      'setup-screen', 'ai-setup-screen', 'room-create-screen',
      'lobby-screen', 'waiting-room-screen'
    ];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  showMenu() {
    this._hideAllScreens();
    this._stopOnlineTimer();
    this._coinDeducted = false;
    document.getElementById('menu-screen').style.display = 'flex';
    this.updateCoinDisplay();
  }

  showSetupScreen() {
    this._hideAllScreens();
    document.getElementById('setup-screen').style.display = 'flex';
  }

  showRoomCreateScreen() {
    this._hideAllScreens();
    document.getElementById('room-create-screen').style.display = 'flex';
  }

  showLobbyScreen() {
    this._hideAllScreens();
    document.getElementById('lobby-screen').style.display = 'flex';
    if (this.onlineGame && this.onlineGame.connected) {
      this.onlineGame.fetchLobby();
    }
  }

  showWaitingRoom(roomInfo) {
    this._hideAllScreens();
    this._wrReadyState = false;
    document.getElementById('waiting-room-screen').style.display = 'flex';
    this.updateWaitingRoom(roomInfo);
    const readyBtn = document.getElementById('wr-ready');
    if (readyBtn) {
      readyBtn.textContent = 'Hazırım';
      readyBtn.classList.remove('secondary-btn');
      readyBtn.classList.add('primary-btn');
    }
  }

  updateWaitingRoom(roomInfo) {
    if (!roomInfo) return;
    this._onlineRoomInfo = roomInfo;

    document.getElementById('wr-room-code').textContent = roomInfo.id;
    document.getElementById('wr-room-name').textContent = roomInfo.name || '-';
    const typeLabels = { private: 'Özel', open: 'Açık', invite: 'Davetli' };
    document.getElementById('wr-room-type').textContent = typeLabels[roomInfo.type] || '-';
    document.getElementById('wr-room-bet').textContent = roomInfo.betAmount + ' coin';

    const players = roomInfo.players || [];
    const host = players.find(p => p.isHost) || players[0];
    const guest = players.find(p => !p.isHost);

    if (host) {
      document.getElementById('wr-host-name').textContent = host.nickname || 'Host';
      document.getElementById('wr-host-ready').textContent = host.ready ? '✓ Hazır' : '';
      document.getElementById('wr-host-ready').className = 'wr-ready-status' + (host.ready ? ' ready' : '');
    }
    if (guest) {
      document.getElementById('wr-guest-name').textContent = guest.nickname || 'Rakip';
      document.getElementById('wr-guest-ready').textContent = guest.ready ? '✓ Hazır' : '';
      document.getElementById('wr-guest-ready').className = 'wr-ready-status' + (guest.ready ? ' ready' : '');
      document.querySelector('.guest-avatar').textContent = '🎮';
    } else {
      document.getElementById('wr-guest-name').textContent = 'Rakip bekleniyor...';
      document.getElementById('wr-guest-ready').textContent = '';
      document.getElementById('wr-guest-ready').className = 'wr-ready-status';
      document.querySelector('.guest-avatar').textContent = '?';
    }
  }

  showGame() {
    this._hideAllScreens();
    document.getElementById('game-screen').style.display = 'flex';
    this.renderAll();
  }

  // ─── Global Notification ─────────────────────────────────────

  showGlobalNotification(message, type = 'info', duration = 5000, roomId = null) {
    const el = document.getElementById('global-notification');
    const textEl = document.getElementById('global-notification-text');
    const actionsEl = document.getElementById('global-notification-actions');

    textEl.textContent = message;
    el.className = 'global-notification gn-' + type;
    el.style.display = 'flex';

    actionsEl.innerHTML = '';
    if (roomId) {
      const btn = document.createElement('button');
      btn.className = 'gn-action-btn';
      btn.textContent = 'Lobiye Git';
      btn.onclick = () => {
        el.style.display = 'none';
        this.showLobbyScreen();
      };
      actionsEl.appendChild(btn);
    }

    clearTimeout(this._gnTimer);
    if (duration > 0) {
      this._gnTimer = setTimeout(() => {
        el.style.display = 'none';
      }, duration);
    }
  }

  showJoinRequest(roomId, requesterId, nickname) {
    const el = document.getElementById('global-notification');
    const textEl = document.getElementById('global-notification-text');
    const actionsEl = document.getElementById('global-notification-actions');

    textEl.textContent = `${nickname} odanıza katılmak istiyor`;
    el.className = 'global-notification gn-info';
    el.style.display = 'flex';

    actionsEl.innerHTML = '';
    const approveBtn = document.createElement('button');
    approveBtn.className = 'gn-action-btn gn-approve';
    approveBtn.textContent = 'Onayla';
    approveBtn.onclick = () => {
      this.onlineGame.approveJoin(roomId, requesterId);
      el.style.display = 'none';
    };

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'gn-action-btn gn-reject';
    rejectBtn.textContent = 'Reddet';
    rejectBtn.onclick = () => {
      this.onlineGame.rejectJoin(roomId, requesterId);
      el.style.display = 'none';
    };

    actionsEl.appendChild(approveBtn);
    actionsEl.appendChild(rejectBtn);

    clearTimeout(this._gnTimer);
    this._gnTimer = setTimeout(() => {
      el.style.display = 'none';
    }, 15000);
  }

  // ─── Online helpers ──────────────────────────────────────────

  updateOnlineCount(count) {
    const el1 = document.getElementById('online-count-text');
    const el2 = document.getElementById('lobby-online-count');
    if (el1) el1.textContent = count;
    if (el2) el2.textContent = count;
  }

  updateLobbyRooms(rooms) {
    const listEl = document.getElementById('lobby-rooms-list');
    const emptyEl = document.getElementById('lobby-empty');
    const searchVal = (document.getElementById('lobby-search')?.value || '').toLowerCase();

    const filtered = rooms.filter(r => {
      if (!searchVal) return true;
      return r.name.toLowerCase().includes(searchVal) ||
             r.hostNickname.toLowerCase().includes(searchVal);
    });

    // Clear existing room cards (keep empty placeholder)
    listEl.querySelectorAll('.lobby-room-card').forEach(c => c.remove());

    if (filtered.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    for (const room of filtered) {
      const card = document.createElement('div');
      card.className = 'lobby-room-card';
      const typeLabels = { open: 'Açık', invite: 'Davetli' };
      const typeBadge = typeLabels[room.type] || room.type;
      card.innerHTML = `
        <div class="lrc-info">
          <div class="lrc-name">${this._escapeHtml(room.name)}</div>
          <div class="lrc-meta">
            <span class="lrc-host">${this._escapeHtml(room.hostNickname)}</span>
            <span class="lrc-badge lrc-badge-${room.type}">${typeBadge}</span>
            <span class="lrc-bet">${room.betAmount} coin</span>
          </div>
        </div>
        <button class="lrc-join-btn" data-room-id="${room.id}" data-room-type="${room.type}">Katıl</button>
      `;
      listEl.appendChild(card);
    }
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  updateCoinDisplay() {
    const coins = APP_SETTINGS.coins;
    const el = document.getElementById('menu-coin-amount');
    if (el) el.textContent = coins;
  }

  // ─── Nickname ─────────────────────────────────────────────────

  ensureNickname() {
    return new Promise(resolve => {
      const existing = APP_SETTINGS.nickname;
      if (existing) {
        resolve(existing);
        return;
      }
      this.showNicknameModal(resolve);
    });
  }

  showNicknameModal(callback) {
    const modal = document.getElementById('nickname-modal');
    const input = document.getElementById('nickname-input');
    const saveBtn = document.getElementById('nickname-save');
    const closeBtn = document.getElementById('nickname-close-btn');
    const backdrop = document.getElementById('nickname-backdrop');

    input.value = APP_SETTINGS.nickname || '';
    modal.style.display = 'flex';
    input.focus();

    const save = () => {
      const nick = input.value.trim().slice(0, 16) || 'Anonim';
      APP_SETTINGS.nickname = nick;
      modal.style.display = 'none';
      cleanup();
      // Update settings display
      const smVal = document.getElementById('sm-nickname-val');
      if (smVal) smVal.textContent = nick;
      // Update Firebase presence nickname
      if (this.onlineGame && this.onlineGame.connected && this.onlineGame._presenceRef) {
        this.onlineGame._presenceRef.update({ nickname: nick }).catch(() => {});
      }
      if (callback) callback(nick);
    };

    const close = () => {
      modal.style.display = 'none';
      cleanup();
      if (callback) callback(APP_SETTINGS.nickname || 'Anonim');
    };

    const onKey = (e) => { if (e.key === 'Enter') save(); };

    const cleanup = () => {
      saveBtn.removeEventListener('click', save);
      closeBtn.removeEventListener('click', close);
      backdrop.removeEventListener('click', close);
      input.removeEventListener('keydown', onKey);
    };

    saveBtn.addEventListener('click', save);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    input.addEventListener('keydown', onKey);
  }

  // ─── Online connection ────────────────────────────────────────

  async connectOnline() {
    if (!this.onlineGame) this.onlineGame = new OnlineGame(this);
    if (this.onlineGame.connected) return;

    this.showGlobalNotification('Firebase bağlantısı kuruluyor...', 'info', 0);
    try {
      await this.onlineGame.connect();
      document.getElementById('global-notification').style.display = 'none';
      this.onlineGame.fetchOnlineCount();
    } catch (err) {
      this.showGlobalNotification(
        'Firebase bağlantısı kurulamadı. Lütfen tekrar deneyin.',
        'warning', 5000
      );
      throw err;
    }
  }

  // ─── Start flows ──────────────────────────────────────────────

  startLocalGame(whitePlayerName, blackPlayerName) {
    this.playerNames.white = whitePlayerName || 'Beyaz';
    this.playerNames.black = blackPlayerName || 'Siyah';
    this.initState(GAME_MODES.LOCAL);
    this.showGame();
    this.beginInitialRoll();
  }

  startAIGame(difficulty, playerColor) {
    this.ai = new BackgammonAI(difficulty || AI_DIFFICULTY.HARD);
    const aiIsBlack = (playerColor || PLAYERS.WHITE) === PLAYERS.WHITE;
    this.playerNames.white = aiIsBlack ? 'Beyaz' : 'Beyaz (AI)';
    this.playerNames.black = aiIsBlack ? 'Siyah (AI)' : 'Siyah';
    this._aiPlayer = aiIsBlack ? PLAYERS.BLACK : PLAYERS.WHITE;
    this.initState(GAME_MODES.AI);
    this.showGame();
    this.beginInitialRoll();
  }

  async startOnlineCreateRoom(options) {
    await this.ensureNickname();
    try {
      await this.connectOnline();
    } catch { return; }
    this.onlineGame.createRoomWithOptions({
      name: options.name,
      type: options.type,
      betAmount: options.betAmount,
      vurkac: options.vurkac !== false
    });
  }

  async openLobby() {
    await this.ensureNickname();
    try {
      await this.connectOnline();
    } catch { return; }
    this.showLobbyScreen();
  }

  async joinOnlineGame(roomId) {
    await this.ensureNickname();
    try {
      await this.connectOnline();
    } catch { return; }
    this.onlineGame.joinRoom(roomId.toUpperCase());
  }

  startOnlineGame() {
    // Legacy: redirect to room create
    this.showRoomCreateScreen();
  }

  initState(mode) {
    this.bearOffCounts = { white: 0, black: 0 };
    this.moveHistory = [];
    this.confirmPending = false;
    this._hitModalPending = false;
    this._autoPlaying = false;
    this._hadChoice = false;
    this._vurkacLockedPoint = null;
    this._cubeState = { value: 1, owner: null, offered: false };
    // Clear old dice display immediately (prevents stale dice on rematch)
    if (this.diceManager) this.diceManager._removeCanvas();
    const diceContainer = document.getElementById('dice-animation-container');
    if (diceContainer) diceContainer.innerHTML = '';
    this.state = {
      board: [...INITIAL_BOARD],
      currentPlayer: PLAYERS.WHITE,
      dice: [],
      remainingDice: [],
      validMoves: [],
      phase: PHASES.INITIAL_ROLL,
      gameMode: mode
    };
  }

  // ─── Initial Roll ─────────────────────────────────────────────

  beginInitialRoll() {
    this.state.phase = PHASES.INITIAL_ROLL;
    this.updateUI();
    setTimeout(() => this.doInitialRoll(), 1000);
  }

  async doInitialRoll() {
    let w, b;
    do { w = this._rand(); b = this._rand(); } while (w === b);

    await this.diceManager.animateRoll([w, b], 600, 'white');

    showInitialRollDice(w, b);
    setTimeout(() => {
      const el = document.getElementById('initial-roll-display');
      if (el) el.innerHTML = '';
    }, 2000);

    if (w > b) {
      this.state.currentPlayer = PLAYERS.WHITE;
      this.state.dice = [w, b];
      this.state.remainingDice = [w, b];
    } else {
      this.state.currentPlayer = PLAYERS.BLACK;
      this.state.dice = [b, w];
      this.state.remainingDice = [b, w];
    }

    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === this._aiPlayer) {
      setTimeout(() => this.doAITurn(), 900);
    } else {
      this._checkAutoPlay();
    }
  }

  // ─── Rolling ──────────────────────────────────────────────────

  async rollDice() {
    if (this.state.phase === PHASES.INITIAL_ROLL) {
      await this.doInitialRoll();
      return;
    }
    if (this.state.phase !== PHASES.ROLLING) return;
    if (this.state.gameMode === GAME_MODES.ONLINE) {
      // Hide roll + double buttons immediately
      const rollBtn = document.getElementById('roll-btn');
      const doubleBtn = document.getElementById('double-btn');
      if (rollBtn) { rollBtn.disabled = true; rollBtn.style.display = 'none'; }
      if (doubleBtn) doubleBtn.style.display = 'none';
      this.onlineGame.rollDice();
      return;
    }

    const dice = rollDice();
    const expanded = expandDice(dice);

    await this.diceManager.animateRoll(expanded, 450, this.state.currentPlayer);

    this.state.dice = expanded;
    this.state.remainingDice = [...expanded];
    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === this._aiPlayer) {
      setTimeout(() => this.doAITurn(), 500);
    } else {
      this._checkAutoPlay();
    }
  }

  // ─── Click handler ─────────────────────────────────────────────

  handlePointClick(point) {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.confirmPending) return;
    if (this._hitModalPending) return;
    if (this._autoPlaying) return;

    const { currentPlayer, board, gameMode } = this.state;
    if (gameMode === GAME_MODES.ONLINE && !this.onlineGame.isMyTurn(currentPlayer)) return;
    if (gameMode === GAME_MODES.AI && currentPlayer === this._aiPlayer) return;

    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && point === this._vurkacLockedPoint) {
      this.showToast('Vur-Kaç: Bu pul bu tur kilitli');
      return;
    }

    const isWhite = currentPlayer === PLAYERS.WHITE;
    const barIndex = isWhite ? 0 : 25;
    const hasBar = board[barIndex] !== 0;

    if (hasBar && point !== barIndex) return;

    let hasPiece = false;
    if (point === barIndex) {
      hasPiece = board[barIndex] !== 0;
    } else if (point >= 1 && point <= 24) {
      hasPiece = isWhite ? board[point] > 0 : board[point] < 0;
    }
    if (!hasPiece) return;

    const movesFromPoint = this.state.validMoves.filter(m => m.from === point);
    if (movesFromPoint.length === 0) return;

    const bestMove = movesFromPoint.reduce((best, m) => m.die > best.die ? m : best);
    this.applyPlayerMove(bestMove);
  }

  // ─── Drag-and-drop handler ────────────────────────────────────

  async handleDrop(from, to) {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.confirmPending) return;
    if (this._hitModalPending) return;
    if (this._autoPlaying) return;

    const { currentPlayer, gameMode } = this.state;
    if (gameMode === GAME_MODES.ONLINE && !this.onlineGame.isMyTurn(currentPlayer)) return;
    if (gameMode === GAME_MODES.AI && currentPlayer === this._aiPlayer) return;

    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && from === this._vurkacLockedPoint) {
      this.showToast('Vur-Kaç: Bu pul bu tur kilitli');
      return;
    }

    const moves = this.state.validMoves.filter(m => m.from === from && m.to === to);
    if (moves.length > 0) {
      const bestMove = moves.reduce((a, b) => a.die < b.die ? a : b);
      this.applyPlayerMove(bestMove);
      return;
    }

    const allSequences = this._findAllMoveSequences(
      from, to, [...this.state.board], [...this.state.remainingDice]
    );

    if (allSequences.length === 0) return;

    if (allSequences.length === 1) {
      this._applyMoveSequence(allSequences[0]);
      return;
    }

    const isWhite = currentPlayer === PLAYERS.WHITE;
    const board = this.state.board;
    const hittingSeqs = [];
    const nonHittingSeqs = [];

    for (const seq of allSequences) {
      const hitInfo = this._sequenceIntermediateHit(seq, board, isWhite);
      if (hitInfo) hittingSeqs.push({ seq, hitPoint: hitInfo });
      else nonHittingSeqs.push(seq);
    }

    if (hittingSeqs.length === 0) {
      this._applyMoveSequence(nonHittingSeqs[0]);
      return;
    }
    if (nonHittingSeqs.length === 0) {
      this._applyMoveSequence(hittingSeqs[0].seq);
      return;
    }

    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac) {
      const homeStart = isWhite ? 19 : 1;
      const homeEnd   = isWhite ? 24 : 6;
      const allInHome = hittingSeqs.every(
        h => h.hitPoint >= homeStart && h.hitPoint <= homeEnd
      );
      if (allInHome) {
        this._applyMoveSequence(nonHittingSeqs[0]);
        return;
      }
    }

    const hitPoint = hittingSeqs[0].hitPoint;
    this._hitModalPending = true;
    const wantHit = await this.showHitConfirmModal(hitPoint);
    this._hitModalPending = false;

    if (this.state.phase !== PHASES.MOVING) return;

    if (wantHit) {
      this._applyMoveSequence(hittingSeqs[0].seq);
    } else {
      this._applyMoveSequence(nonHittingSeqs[0]);
    }
  }

  _findMoveSequence(from, finalDest, board, dice) {
    const player = this.state.currentPlayer;
    const isWhite = player === PLAYERS.WHITE;
    const barIndex = isWhite ? 0 : 25;

    for (const die of [...new Set(dice)]) {
      const hasBar = board[barIndex] !== 0;
      const movesForDie = getMovesForDie(board, player, die, hasBar, isWhite)
        .filter(m => m.from === from);
      for (const move of movesForDie) {
        if (move.to === finalDest) return [move];
        if (dice.length > 1) {
          if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac) {
            const isHit = board[move.to] === (isWhite ? -1 : 1);
            if (isHit) {
              const homeStart = isWhite ? 19 : 1;
              const homeEnd   = isWhite ? 24 : 6;
              if (move.to >= homeStart && move.to <= homeEnd) continue;
            }
          }
          const newBoard = applyMove(board, move, player);
          const newDice = getDiceAfterMove(dice, die);
          const rest = this._findMoveSequence(move.to, finalDest, newBoard, newDice);
          if (rest !== null) return [move, ...rest];
        }
      }
    }
    return null;
  }

  _findAllMoveSequences(from, finalDest, board, dice) {
    const results = [];
    const player = this.state.currentPlayer;
    const isWhite = player === PLAYERS.WHITE;
    const barIndex = isWhite ? 0 : 25;

    const recurse = (curFrom, curBoard, curDice, path) => {
      for (const die of [...new Set(curDice)]) {
        const hasBar = curBoard[barIndex] !== 0;
        const movesForDie = getMovesForDie(curBoard, player, die, hasBar, isWhite)
          .filter(m => m.from === curFrom);

        for (const move of movesForDie) {
          if (move.to === finalDest) {
            results.push([...path, move]);
          } else if (curDice.length > 1) {
            const newBoard = applyMove(curBoard, move, player);
            const newDice = getDiceAfterMove(curDice, die);
            recurse(move.to, newBoard, newDice, [...path, move]);
          }
        }
      }
    };

    recurse(from, board, dice, []);

    const seen = new Set();
    return results.filter(seq => {
      const key = seq.map(m => `${m.from}-${m.to}-${m.die}`).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  _sequenceIntermediateHit(sequence, board, isWhite) {
    let curBoard = [...board];
    for (let i = 0; i < sequence.length - 1; i++) {
      const move = sequence[i];
      const opponentBlot = isWhite ? -1 : 1;
      if (curBoard[move.to] === opponentBlot) return move.to;
      curBoard = applyMove(curBoard, move, isWhite ? PLAYERS.WHITE : PLAYERS.BLACK);
    }
    return null;
  }

  showHitConfirmModal(hitPoint) {
    return new Promise(resolve => {
      const modal = document.getElementById('hit-confirm-modal');
      const msgEl = document.getElementById('hit-confirm-text');
      msgEl.textContent = `${hitPoint}. noktadaki rakip pulu kırmak ister misin?`;
      modal.style.display = 'flex';

      const hitBtn  = document.getElementById('hit-confirm-yes');
      const skipBtn = document.getElementById('hit-confirm-no');

      const cleanup = () => {
        modal.style.display = 'none';
        hitBtn.removeEventListener('click', onHit);
        skipBtn.removeEventListener('click', onSkip);
      };
      const onHit  = () => { cleanup(); resolve(true); };
      const onSkip = () => { cleanup(); resolve(false); };

      hitBtn.addEventListener('click', onHit);
      skipBtn.addEventListener('click', onSkip);
    });
  }

  _applyMoveSequence(sequence) {
    this._hadChoice = true;
    this.pushHistory();

    for (const move of sequence) {
      const { currentPlayer } = this.state;
      const isWhiteSeq = currentPlayer === PLAYERS.WHITE;
      const isHitSeq = this.state.board[move.to] === (isWhiteSeq ? -1 : 1);

      const isBearOff = (currentPlayer === PLAYERS.WHITE && move.to === 25) ||
          (currentPlayer === PLAYERS.BLACK && move.to === 0);

      let soundType = 'move';
      if (isBearOff) {
        this.bearOffCounts[currentPlayer]++;
        soundType = 'bearoff';
      } else if (isHitSeq) {
        soundType = 'hit';
      }
      if (window.sounds) sounds.play(soundType);

      if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && isHitSeq) {
        const homeStart = isWhiteSeq ? 19 : 1;
        const homeEnd   = isWhiteSeq ? 24 : 6;
        if (move.to >= homeStart && move.to <= homeEnd) {
          this._vurkacLockedPoint = move.to;
        }
      }

      this.state.board = applyMove(this.state.board, move, currentPlayer);
      this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);
      if (this.state.gameMode === GAME_MODES.ONLINE) this.onlineGame.makeMove(move, soundType);

      if (isGameOver(this.state.board)) {
        const winner = getWinner(this.state.board);
        if (window.sounds) sounds.play('gameover');
        this.renderAll();
        if (this.state.gameMode === GAME_MODES.ONLINE) {
          // Let Firebase listener handle endGame with proper betAmount/cubeValue
          return;
        }
        this.endGame(winner, getGameType(this.state.board, winner));
        return;
      }
    }

    this.updateValidMoves();
    this.renderAll();

    if (this.state.remainingDice.length === 0) {
      this._showConfirmButton();
    } else {
      this._checkAutoPlay();
    }
  }

  // ─── Hover hints ──────────────────────────────────────────────

  handlePieceHover(point) {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this._hitModalPending) return;
    const { currentPlayer, gameMode, board, remainingDice } = this.state;
    if (gameMode === GAME_MODES.ONLINE && this.onlineGame && !this.onlineGame.isMyTurn(currentPlayer)) return;
    if (gameMode === GAME_MODES.AI && currentPlayer === this._aiPlayer) return;

    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && point === this._vurkacLockedPoint) {
      this.boardRenderer.showGhostHighlights([], false, board);
      return;
    }

    const isWhite = point === 0 ? true : (point === 25 ? false : board[point] > 0);
    const destinations = this._computeHoverDestinations(point, board, currentPlayer, remainingDice);
    this.boardRenderer.showGhostHighlights(destinations, isWhite, board);
  }

  _computeHoverDestinations(from, board, player, remainingDice) {
    const isWhite = player === PLAYERS.WHITE;
    const barIndex = isWhite ? 0 : 25;
    const hasBar = board[barIndex] !== 0;

    if (hasBar && from !== barIndex) return [];

    const results = new Map();

    const recurse = (curBoard, curFrom, diceLeft, sumSoFar) => {
      const unique = [...new Set(diceLeft)];
      for (const die of unique) {
        const curHasBar = curBoard[barIndex] !== 0;
        const movesForDie = getMovesForDie(curBoard, player, die, curHasBar, isWhite)
          .filter(m => m.from === curFrom);

        for (const move of movesForDie) {
          const newSum = sumSoFar + die;
          if (!results.has(move.to)) results.set(move.to, newSum);

          if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac) {
            const isHit = curBoard[move.to] === (isWhite ? -1 : 1);
            if (isHit) {
              const homeStart = isWhite ? 19 : 1;
              const homeEnd   = isWhite ? 24 : 6;
              if (typeof move.to === 'number' && move.to >= homeStart && move.to <= homeEnd) {
                continue;
              }
            }
          }

          if (diceLeft.length > 1) {
            const newBoard = applyMove(curBoard, move, player);
            const newDice = getDiceAfterMove(diceLeft, die);
            recurse(newBoard, move.to, newDice, newSum);
          }
        }
      }
    };

    recurse(board, from, remainingDice, 0);
    return [...results.entries()].map(([to, diceSum]) => ({ to, diceSum }));
  }

  // ─── Undo ────────────────────────────────────────────────────

  pushHistory() {
    this.moveHistory.push({
      board: [...this.state.board],
      remainingDice: [...this.state.remainingDice],
      bearOffCounts: { ...this.bearOffCounts },
      vurkacLockedPoint: this._vurkacLockedPoint
    });
  }

  undo() {
    if (this.moveHistory.length === 0) return;
    if (this.state.phase === PHASES.GAMEOVER) return;
    if (this._hitModalPending) return;

    this.confirmPending = false;
    this._hideConfirmButton();

    const snap = this.moveHistory.pop();
    this.state.board = snap.board;
    this.state.remainingDice = snap.remainingDice;
    this.bearOffCounts = snap.bearOffCounts;
    this._vurkacLockedPoint = snap.vurkacLockedPoint;
    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    // Sync undo to Firebase for online mode
    if (this.state.gameMode === GAME_MODES.ONLINE && this.onlineGame) {
      this.onlineGame.undoToState(snap.board, snap.remainingDice);
    }
  }

  // ─── Apply a move ─────────────────────────────────────────────

  applyPlayerMove(move) {
    const { currentPlayer } = this.state;

    this._hadChoice = true;
    this.pushHistory();

    const isWhitePlayer = currentPlayer === PLAYERS.WHITE;
    const isHit = this.state.board[move.to] === (isWhitePlayer ? -1 : 1);

    const isBearOffPM = (currentPlayer === PLAYERS.WHITE && move.to === 25) ||
        (currentPlayer === PLAYERS.BLACK && move.to === 0);

    let soundTypePM = 'move';
    if (isBearOffPM) {
      this.bearOffCounts[currentPlayer]++;
      soundTypePM = 'bearoff';
    } else if (isHit) {
      soundTypePM = 'hit';
    }
    if (window.sounds) sounds.play(soundTypePM);

    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && isHit) {
      const homeStart = isWhitePlayer ? 19 : 1;
      const homeEnd   = isWhitePlayer ? 24 : 6;
      if (move.to >= homeStart && move.to <= homeEnd) {
        this._vurkacLockedPoint = move.to;
      }
    }

    this.state.board = applyMove(this.state.board, move, currentPlayer);
    this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);

    if (this.state.gameMode === GAME_MODES.ONLINE) {
      this.onlineGame.makeMove(move, soundTypePM);
    }

    if (isGameOver(this.state.board)) {
      const winner = getWinner(this.state.board);
      const gameType = getGameType(this.state.board, winner);
      if (window.sounds) sounds.play('gameover');
      if (this.state.gameMode === GAME_MODES.ONLINE) {
        // Let Firebase listener handle endGame with proper betAmount/cubeValue
        this.renderAll();
        return;
      }
      this.endGame(winner, gameType);
      return;
    }

    this.updateValidMoves();
    this.renderAll();

    if (this.state.remainingDice.length === 0) {
      this._showConfirmButton();
    } else {
      this._checkAutoPlay();
    }
  }

  // ─── Confirm turn end ─────────────────────────────────────────

  _showConfirmButton() {
    this.confirmPending = true;
    this.updateUI();
  }

  _hideConfirmButton() {
    this.confirmPending = false;
    this.updateUI();
  }

  confirmTurnEnd() {
    if (!this.confirmPending) return;
    this.confirmPending = false;
    this._hideConfirmButton();
    this.endTurn();
  }

  updateValidMoves() {
    let moves = filterMovesForMaxDiceUsage(
      this.state.board, this.state.currentPlayer, this.state.remainingDice
    );
    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && this._vurkacLockedPoint !== null) {
      moves = moves.filter(m => m.from !== this._vurkacLockedPoint);
    }
    this.state.validMoves = moves;
  }

  // ─── Turn end ─────────────────────────────────────────────────

  endTurn() {
    this.moveHistory = [];
    this.confirmPending = false;
    this._autoPlaying = false;
    this._hadChoice = false;
    this._vurkacLockedPoint = null;

    const currentPlayer = this.state.currentPlayer;
    const nextPlayer = currentPlayer === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;

    // Calculate bonus time used for online
    let bonusUsed = 0;
    if (this.state.gameMode === GAME_MODES.ONLINE && this._timerTurnStart) {
      const elapsed = this._getServerTime() - this._timerTurnStart;
      bonusUsed = Math.max(0, elapsed - 20000);
    }

    const nextBarIdx = nextPlayer === PLAYERS.WHITE ? 0 : 25;
    const nextHasBar = nextPlayer === PLAYERS.WHITE ? this.state.board[nextBarIdx] > 0 : this.state.board[nextBarIdx] < 0;

    if (nextHasBar && isSchoolClosed(this.state.board, currentPlayer)) {
      if (!this._schoolClosedShown) {
        this._schoolClosedShown = true;
        this.showToast('Okullar kapalı');
      }
      this.state.dice = [];
      this.state.remainingDice = [];
      this.state.validMoves = [];
      this.state.phase = PHASES.ROLLING;
      this.updateUI();
      this.renderAll();
      if (this.state.gameMode === GAME_MODES.ONLINE) {
        // Update bonus, same player keeps turn
        if (bonusUsed > 0) {
          if (currentPlayer === PLAYERS.WHITE) this._timerBonusWhite = Math.max(0, this._timerBonusWhite - bonusUsed);
          else this._timerBonusBlack = Math.max(0, this._timerBonusBlack - bonusUsed);
        }
        const timerUpdate = {
          color: currentPlayer,
          bonusRemaining: currentPlayer === PLAYERS.WHITE ? this._timerBonusWhite : this._timerBonusBlack
        };
        this.onlineGame.confirmTurn(currentPlayer, timerUpdate);
      } else {
        setTimeout(() => this.rollDice(), 1000);
      }
      return;
    }

    this._schoolClosedShown = false;
    this.state.currentPlayer = nextPlayer;
    this.state.dice = [];
    this.state.remainingDice = [];
    this.state.validMoves = [];
    this.state.phase = PHASES.ROLLING;
    this.updateUI();
    this.renderAll();

    if (this.state.gameMode === GAME_MODES.ONLINE) {
      // Update bonus for player who just played
      if (bonusUsed > 0) {
        if (currentPlayer === PLAYERS.WHITE) this._timerBonusWhite = Math.max(0, this._timerBonusWhite - bonusUsed);
        else this._timerBonusBlack = Math.max(0, this._timerBonusBlack - bonusUsed);
      }
      const timerUpdate = {
        color: currentPlayer,
        bonusRemaining: currentPlayer === PLAYERS.WHITE ? this._timerBonusWhite : this._timerBonusBlack
      };
      this.onlineGame.confirmTurn(nextPlayer, timerUpdate);
    } else {
      setTimeout(() => this.rollDice(), 1000);
    }
  }

  // ─── Auto-play forced moves ────────────────────────────────────

  async _checkAutoPlay() {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.state.gameMode === GAME_MODES.ONLINE) {
      // Only auto-play for current player's own turn
      if (!this.onlineGame || !this.onlineGame.isMyTurn(this.state.currentPlayer)) return;
    }
    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === this._aiPlayer) return;

    const moves = this.state.validMoves;

    if (moves.length === 0) {
      const isWhite = this.state.currentPlayer === PLAYERS.WHITE;
      const barIdx = isWhite ? 0 : 25;
      if (this.state.board[barIdx] !== 0) {
        this.showToast('Kırık pul giremedi');
      } else if (this.state.remainingDice.length > 0) {
        this.showToast('Kalan zarlarla oynayacak hamle yok');
      }

      if (this._hadChoice) {
        this._autoPlaying = false;
        this._showConfirmButton();
      } else {
        this._autoPlaying = true;
        await this.delay(1500);
        this._autoPlaying = false;
        if (this.state.phase === PHASES.MOVING) this.endTurn();
      }
      return;
    }

    const uniquePairs = new Set(moves.map(m => `${m.from}-${m.to}`));
    if (uniquePairs.size > 1) {
      this._autoPlaying = false;
      this.updateUI();
      return;
    }

    this._autoPlaying = true;
    await this.delay(350);
    if (this.state.phase !== PHASES.MOVING) { this._autoPlaying = false; return; }

    const move = moves.reduce((a, b) => a.die < b.die ? a : b);
    this._applyForcedMove(move);
  }

  _applyForcedMove(move) {
    const { currentPlayer } = this.state;

    const isBearOffFM = (currentPlayer === PLAYERS.WHITE && move.to === 25) ||
        (currentPlayer === PLAYERS.BLACK && move.to === 0);
    const isHitFM = !isBearOffFM && this.state.board[move.to] === (currentPlayer === PLAYERS.WHITE ? -1 : 1);

    let soundTypeFM = 'move';
    if (isBearOffFM) {
      this.bearOffCounts[currentPlayer]++;
      soundTypeFM = 'bearoff';
    } else if (isHitFM) {
      soundTypeFM = 'hit';
    }
    if (window.sounds) sounds.play(soundTypeFM);

    this.state.board = applyMove(this.state.board, move, currentPlayer);
    this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);

    if (this.state.gameMode === GAME_MODES.ONLINE) {
      this.onlineGame.makeMove(move, soundTypeFM);
    }

    if (isGameOver(this.state.board)) {
      const winner = getWinner(this.state.board);
      if (window.sounds) sounds.play('gameover');
      this.endGame(winner, getGameType(this.state.board, winner));
      return;
    }

    this.updateValidMoves();
    this.renderAll();

    if (this.state.remainingDice.length === 0) {
      if (this._hadChoice) {
        this._autoPlaying = false;
        this._showConfirmButton();
      } else {
        setTimeout(() => {
          this._autoPlaying = false;
          if (this.state.phase === PHASES.MOVING) this.endTurn();
        }, 450);
      }
    } else {
      setTimeout(() => this._checkAutoPlay(), 350);
    }
  }

  // ─── AI turn — visible step-by-step ──────────────────────────

  async doAITurn() {
    const aiPlayer = this._aiPlayer;
    if (this.state.currentPlayer !== aiPlayer) return;
    if (this.state.phase !== PHASES.MOVING) return;

    const vurkacEnabled = !!(window.APP_SETTINGS && window.APP_SETTINGS.vurkac);
    const bestMoves = this.ai.getBestMoves(
      this.state.board, aiPlayer, this.state.remainingDice, vurkacEnabled
    );

    if (bestMoves.length === 0) {
      setTimeout(() => this.endTurn(), 400);
      return;
    }

    this.showStatusMessage('Bilgisayar oynuyor...');
    await this.delay(350);

    const aiBearOff = aiPlayer === PLAYERS.WHITE ? 25 : 0;
    const aiBarIdx  = aiPlayer === PLAYERS.WHITE ? 0 : 25;
    const oppBlot   = aiPlayer === PLAYERS.WHITE ? -1 : 1;

    for (const move of bestMoves) {
      const fromLabel = move.from === aiBarIdx ? 'Bar' : `${move.from}. nokta`;
      const toLabel   = move.to   === aiBearOff ? 'Çıkış' : `${move.to}. nokta`;
      this.showStatusMessage(`▶ ${fromLabel} → ${toLabel}`);

      this.boardRenderer.flashPoint(move.from, '#FFD700');
      await this.delay(480);

      if (move.to === aiBearOff) {
        this.bearOffCounts[aiPlayer]++;
        if (window.sounds) sounds.play('bearoff');
      } else if (this.state.board[move.to] === oppBlot) {
        if (window.sounds) sounds.play('hit');
      } else {
        if (window.sounds) sounds.play('move');
      }

      this.state.board = applyMove(this.state.board, move, aiPlayer);
      this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);

      this.boardRenderer.flashPoint(move.to, '#27AE60');
      this.updateValidMoves();
      this.renderAll();

      if (isGameOver(this.state.board)) {
        const winner = getWinner(this.state.board);
        const gameType = getGameType(this.state.board, winner);
        if (window.sounds) sounds.play('gameover');
        this.endGame(winner, gameType);
        return;
      }

      await this.delay(420);
    }

    setTimeout(() => this.endTurn(), 400);
  }

  // ─── Game over ────────────────────────────────────────────────

  endGame(winner, gameType, cubeValue = 1, betAmount = 0) {
    this.state.phase = PHASES.GAMEOVER;
    this._lastWinner = winner;
    this._stopOnlineTimer();
    this.confirmPending = false;
    this._hideConfirmButton();
    this.renderAll();

    const labels = { normal: '', gammon: ' (Gamen!)', backgammon: ' (Backgammon!)', resign: ' (Teslim)', disconnect: ' (Bağlantı kesildi)', 'double-decline': ' (Çift reddedildi)', timeout: ' (Süre doldu)' };
    const winnerLabel = winner === PLAYERS.WHITE
      ? this.playerNames.white
      : this.playerNames.black;
    document.getElementById('gameover-title').textContent = `${winnerLabel} Kazandı!${labels[gameType] || ''}`;
    const points = gameType === 'backgammon' ? 3 : gameType === 'gammon' ? 2 : 1;
    document.getElementById('gameover-points').textContent = `${points} puan`;

    // Coin calculation for online mode
    const coinResultEl = document.getElementById('gameover-coin-result');
    const coinTextEl = document.getElementById('gameover-coin-text');
    if (this.state.gameMode === GAME_MODES.ONLINE && betAmount > 0) {
      const multiplier = points * cubeValue;
      const fullStake = betAmount * multiplier;
      const isMyWin = this.onlineGame && this.onlineGame.myColor === winner;

      if (isMyWin) {
        // Get bet back + winnings
        APP_SETTINGS.coins = APP_SETTINGS.coins + betAmount + fullStake;
        coinTextEl.textContent = '+' + fullStake + ' coin kazandınız!';
        coinTextEl.style.color = 'var(--green)';
      } else {
        // Already lost betAmount at start, deduct additional if needed
        const additionalLoss = fullStake - betAmount;
        if (additionalLoss > 0) {
          APP_SETTINGS.coins = APP_SETTINGS.coins - additionalLoss;
        }
        coinTextEl.textContent = '-' + fullStake + ' coin kaybettiniz';
        coinTextEl.style.color = 'var(--danger)';
      }
      coinResultEl.style.display = 'block';
      this.updateCoinDisplay();
    } else {
      coinResultEl.style.display = 'none';
    }

    // Hide "Yeni Oyun" button in online mode gameover, show "Tekrar Oyna" instead
    const goNewBtn = document.getElementById('gameover-new-game');
    const goRematchBtn = document.getElementById('gameover-rematch');
    const rematchStatus = document.getElementById('gameover-rematch-status');
    if (goNewBtn) goNewBtn.style.display = (this.state.gameMode === GAME_MODES.ONLINE) ? 'none' : '';
    if (goRematchBtn) {
      goRematchBtn.style.display = (this.state.gameMode === GAME_MODES.ONLINE) ? '' : 'none';
      goRematchBtn.disabled = false;
      goRematchBtn.textContent = 'Tekrar Oyna';
    }
    if (rematchStatus) rematchStatus.style.display = 'none';

    document.getElementById('gameover-screen').style.display = 'flex';
  }

  resign() {
    if (this.state.phase === PHASES.GAMEOVER) return;
    const winner = this.state.currentPlayer === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    if (this.state.gameMode === GAME_MODES.ONLINE) {
      this.onlineGame.resign();
    } else {
      this.endGame(winner, 'resign');
    }
  }

  newGame() {
    if (this.state && this.state.gameMode === GAME_MODES.AI) {
      this.startAIGame(this.ai ? this.ai.difficulty : AI_DIFFICULTY.HARD);
    } else if (this.state && this.state.gameMode === GAME_MODES.LOCAL) {
      this.startLocalGame(this.playerNames.white, this.playerNames.black);
    } else {
      this.showMenu();
    }
  }

  // ─── Custom confirm modal ─────────────────────────────────────

  showModal(message) {
    return new Promise(resolve => {
      const modal = document.getElementById('custom-modal');
      document.getElementById('modal-text').textContent = message;
      modal.style.display = 'flex';

      const yes = document.getElementById('modal-yes');
      const no  = document.getElementById('modal-no');

      const cleanup = () => {
        modal.style.display = 'none';
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
      };
      const onYes = () => { cleanup(); resolve(true); };
      const onNo  = () => { cleanup(); resolve(false); };

      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
    });
  }

  // ─── Online callbacks ─────────────────────────────────────────

  loadOnlineState(gameState, myColor, roomInfo) {
    this._onlineRoomInfo = roomInfo;
    this.initState(GAME_MODES.ONLINE);
    this.state.board = gameState.board;
    this.state.currentPlayer = gameState.currentPlayer;

    // For rematch (phase=moving with dice), defer dice display to animation
    const isRematchStart = gameState.phase === 'moving' && gameState.dice && gameState.dice.length > 0;

    if (isRematchStart) {
      // Don't set dice yet — animation will handle it
      this.state.dice = [];
      this.state.remainingDice = [];
      this.state.phase = PHASES.ROLLING; // temporarily rolling until animation
    } else {
      this.state.dice = gameState.dice || [];
      this.state.remainingDice = gameState.remainingDice || [];
      if (gameState.phase === 'initial_roll') {
        this.state.phase = PHASES.INITIAL_ROLL;
      } else {
        this.state.phase = gameState.remainingDice && gameState.remainingDice.length > 0
          ? PHASES.MOVING : PHASES.ROLLING;
      }
    }

    if (roomInfo && roomInfo.players) {
      const whitePlayer = roomInfo.players.find(p => p.color === 'white');
      const blackPlayer = roomInfo.players.find(p => p.color === 'black');
      this.playerNames.white = whitePlayer ? whitePlayer.nickname : 'Beyaz';
      this.playerNames.black = blackPlayer ? blackPlayer.nickname : 'Siyah';
    }

    // Apply room's vurkac setting
    if (roomInfo && roomInfo.vurkac !== undefined) {
      APP_SETTINGS.vurkac = roomInfo.vurkac;
    }

    // Deduct bet coins on match start
    if (!this._coinDeducted && roomInfo && roomInfo.betAmount > 0) {
      APP_SETTINGS.coins = APP_SETTINGS.coins - roomInfo.betAmount;
      this._coinDeducted = true;
      this.updateCoinDisplay();
    }

    // Init timer
    this._timerTurnStart = gameState.turnStartedAt || null;
    if (gameState.timer) {
      this._timerBonusWhite = gameState.timer.white ? gameState.timer.white.bonusRemaining : 60000;
      this._timerBonusBlack = gameState.timer.black ? gameState.timer.black.bonusRemaining : 60000;
    }

    this.showGame();
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    // Trigger dice animation for rematch start
    if (isRematchStart) {
      // Set dice in state immediately (prevents Firebase listener re-trigger)
      this.state.dice = [...gameState.dice];
      this.onlineRollReceived(gameState.dice, gameState.currentPlayer);
      this._startOnlineTimer();
    }
  }

  async doOnlineInitialRoll(whiteRoll, blackRoll, firstPlayer, dice) {
    await this.diceManager.animateRoll([whiteRoll, blackRoll], 600, 'white');

    showInitialRollDice(whiteRoll, blackRoll);
    setTimeout(() => {
      const el = document.getElementById('initial-roll-display');
      if (el) el.innerHTML = '';
    }, 2000);

    this.state.dice = dice;
    this.state.remainingDice = [...dice];
    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    // Start timer after animation
    this._timerTurnStart = this._getServerTime();
    this._startOnlineTimer();

    // Host resets turnStartedAt after animation delay
    if (this.onlineGame && this.onlineGame._isHost) {
      this.onlineGame.db.ref('rooms/' + this.onlineGame.roomId + '/gameState/turnStartedAt')
        .set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
    }

    // Check if the current player has no valid moves from the start
    this._checkAutoPlay();
  }

  async onlineRollReceived(dice, player) {
    // Animate dice roll for both players (dice already expanded from Firebase)
    const displayDice = dice.length <= 2 ? dice : dice.slice(0, 2);
    await this.diceManager.animateRoll(displayDice, 450, player);

    this.state.dice = [...dice];
    this.state.remainingDice = [...dice];
    this.state.phase = PHASES.MOVING;
    this.moveHistory = [];
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    // Check if the current player has no valid moves (e.g. bar piece can't enter)
    this._checkAutoPlay();
  }

  onlineMoveReceived(gameState, move) {
    // Sound is played early in _listenLastMove (before async board read) for sync.
    // soundType===null means sound was already played; skip here to avoid double play.
    if (move.soundType !== null && window.sounds) {
      sounds.play(move.soundType || 'move');
    }

    this.state.board = gameState.board;
    this.state.remainingDice = gameState.remainingDice || [];
    this.updateValidMoves();
    this.renderAll();
  }

  onlineTurnChanged(currentPlayer, turnStartedAt, timer) {
    this.state.currentPlayer = currentPlayer;
    this.state.phase = PHASES.ROLLING;
    this.state.dice = [];
    this.state.remainingDice = [];
    this.state.validMoves = [];
    this.moveHistory = [];
    this.confirmPending = false;
    this._vurkacLockedPoint = null;

    // Update timer
    if (turnStartedAt) this._timerTurnStart = turnStartedAt;
    if (timer) {
      this._timerBonusWhite = timer.white ? timer.white.bonusRemaining : this._timerBonusWhite;
      this._timerBonusBlack = timer.black ? timer.black.bonusRemaining : this._timerBonusBlack;
    }

    this.updateUI();
    this.renderAll();
  }

  onlineGameOver(winner, type, cubeValue = 1, betAmount = 0) {
    this.endGame(winner, type, cubeValue, betAmount);
  }

  onRematchRequested() {
    const statusEl = document.getElementById('gameover-rematch-status');
    const textEl = document.getElementById('gameover-rematch-text');
    if (statusEl && textEl) {
      textEl.textContent = 'Rakip tekrar oynamak istiyor!';
      statusEl.style.display = 'block';
    }
  }

  onlinePlayerLeft() {
    document.getElementById('gameover-title').textContent = 'Rakip Ayrıldı';
    document.getElementById('gameover-screen').style.display = 'flex';
  }

  // ─── Doubling Cube ────────────────────────────────────────────

  onDoubleOffered(cube) {
    this._cubeState = { value: cube.value, owner: cube.owner, offered: true };
    // Show double response modal — listener already verified this is the opponent's offer
    const modal = document.getElementById('double-modal');
    const text = document.getElementById('double-modal-text');
    text.textContent = `Rakip bahsi ${cube.value * 2}x'e katlamak istiyor!`;
    modal.style.display = 'flex';
    modal.style.zIndex = '9000';
    this._updateDoublingCubeDisplay(cube);
    this.updateUI();
  }

  onDoubleAccepted(cube) {
    this._cubeState = { value: cube.value, owner: cube.owner, offered: false };
    const dm = document.getElementById('double-modal');
    dm.style.display = 'none';
    dm.style.zIndex = '';
    this._updateDoublingCubeDisplay(cube);
    this.showToast(`Bahis ${cube.value}x'e katlandı!`);
    this.updateUI();
  }

  _updateDoublingCubeDisplay(cube) {
    const el = document.getElementById('doubling-cube-display');
    const valEl = document.getElementById('dc-value');
    if (this.state && this.state.gameMode === GAME_MODES.ONLINE) {
      el.style.display = 'flex';
      valEl.textContent = cube.value;
    } else {
      el.style.display = 'none';
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  renderAll() {
    if (!this.boardRenderer) return;
    this.boardRenderer.render(
      this.state.board, null, [],
      this.state.remainingDice,
      this.state.currentPlayer,
      this.bearOffCounts
    );
    this.diceManager.showDiceResult(
      this.state.dice,
      this.state.remainingDice,
      this.state.currentPlayer
    );
  }

  updateUI() {
    const { currentPlayer, phase, gameMode } = this.state;
    const isAITurn = gameMode === GAME_MODES.AI && currentPlayer === this._aiPlayer;
    const isOnline = gameMode === GAME_MODES.ONLINE;

    // Roll button: only visible in online mode
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) {
      if (isOnline) {
        const myTurn = this.onlineGame && this.onlineGame.isMyTurn(currentPlayer);
        rollBtn.style.display = (phase === PHASES.ROLLING && myTurn) ? '' : 'none';
        rollBtn.disabled = false;
      } else {
        rollBtn.style.display = 'none';
      }
    }

    // Double button: visible in online mode during rolling phase, if cube ownership allows
    const doubleBtn = document.getElementById('double-btn');
    if (doubleBtn) {
      if (isOnline && phase === PHASES.ROLLING && !this._cubeState.offered) {
        const myTurn = this.onlineGame && this.onlineGame.isMyTurn(currentPlayer);
        const myColor = this.onlineGame ? this.onlineGame.myColor : null;
        const canDouble = this._cubeState.owner === null || this._cubeState.owner === myColor;
        doubleBtn.style.display = (myTurn && canDouble) ? '' : 'none';
      } else {
        doubleBtn.style.display = 'none';
      }
    }

    // Undo button (enabled for online mode too — only for own turn)
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      const myTurnForUndo = isOnline
        ? this.onlineGame && this.onlineGame.isMyTurn(currentPlayer)
        : true;
      const showUndo = !isAITurn && myTurnForUndo &&
        phase === PHASES.MOVING && this.moveHistory.length > 0;
      undoBtn.style.display = showUndo ? '' : 'none';
    }

    // Confirm button
    const confirmBtn = document.getElementById('confirm-turn-btn');
    if (confirmBtn) {
      confirmBtn.style.display = this.confirmPending ? '' : 'none';
    }

    // Side panel active-turn highlight
    const panelWhite = document.getElementById('panel-white');
    const panelBlack = document.getElementById('panel-black');
    if (panelWhite) panelWhite.classList.toggle('active-turn', currentPlayer === PLAYERS.WHITE && phase === PHASES.MOVING);
    if (panelBlack) panelBlack.classList.toggle('active-turn', currentPlayer === PLAYERS.BLACK && phase === PHASES.MOVING);

    // Hide new-game button in online mode
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
      newGameBtn.style.display = isOnline ? 'none' : '';
    }

    // Pip and off counts
    const whitePip = getPipCount(this.state.board, PLAYERS.WHITE);
    const blackPip = getPipCount(this.state.board, PLAYERS.BLACK);
    const wp = document.getElementById('white-pip'); if (wp) wp.textContent = whitePip;
    const bp = document.getElementById('black-pip'); if (bp) bp.textContent = blackPip;
    const wo = document.getElementById('white-off'); if (wo) wo.textContent = this.bearOffCounts.white;
    const bo = document.getElementById('black-off'); if (bo) bo.textContent = this.bearOffCounts.black;

    // Player names in side panels
    const wName = document.querySelector('#panel-white .sp-name');
    if (wName) wName.textContent = this.playerNames.white;
    const bName = document.querySelector('#panel-black .sp-name');
    if (bName) bName.textContent = this.playerNames.black;

    // Update coin display in panels (online mode)
    if (isOnline && this._onlineRoomInfo) {
      const wCoin = document.getElementById('white-coin');
      const bCoin = document.getElementById('black-coin');
      const myColor = this.onlineGame ? this.onlineGame.myColor : null;
      const bet = this._onlineRoomInfo.betAmount || 0;
      const players = this._onlineRoomInfo.players || [];
      const wPlayer = players.find(p => p.color === 'white');
      const bPlayer = players.find(p => p.color === 'black');
      // My coins: APP_SETTINGS.coins (already deducted). Opponent: stored coins - bet.
      if (wCoin) wCoin.textContent = myColor === 'white'
        ? APP_SETTINGS.coins
        : (wPlayer ? wPlayer.coins - bet : '-');
      if (bCoin) bCoin.textContent = myColor === 'black'
        ? APP_SETTINGS.coins
        : (bPlayer ? bPlayer.coins - bet : '-');
      // Show coin containers
      document.querySelectorAll('.sp-coin, .sp-coin-divider').forEach(el => el.style.display = '');
    } else {
      // Hide coin containers for non-online modes
      document.querySelectorAll('.sp-coin, .sp-coin-divider').forEach(el => el.style.display = 'none');
    }
  }

  showStatusMessage(msg) { /* no-op */ }

  showToast(msg) {
    const el = document.getElementById('game-toast');
    if (!el) return;
    clearTimeout(this._toastTimer);
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    void el.offsetWidth;
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2000);
  }

  // ─── Online Timer ─────────────────────────────────────────

  _getServerTime() {
    const offset = this.onlineGame ? this.onlineGame._serverTimeOffset || 0 : 0;
    return Date.now() + offset;
  }

  _startOnlineTimer() {
    this._stopOnlineTimer();
    this._timerInterval = setInterval(() => this._updateTimerTick(), 100);
  }

  _stopOnlineTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    // Clear timer displays
    this._renderTimer('white', null, false);
    this._renderTimer('black', null, false);
  }

  _updateTimerTick() {
    if (!this.state || this.state.gameMode !== GAME_MODES.ONLINE) {
      this._stopOnlineTimer();
      return;
    }
    if (this.state.phase === PHASES.GAMEOVER || this.state.phase === PHASES.INITIAL_ROLL) return;

    const currentPlayer = this.state.currentPlayer;
    const turnStart = this._timerTurnStart;
    if (!turnStart) return;

    const elapsed = this._getServerTime() - turnStart;
    const bonusRemaining = currentPlayer === PLAYERS.WHITE
      ? this._timerBonusWhite : this._timerBonusBlack;

    const BASE_TIME = 20000;
    let displaySeconds, isBonus;

    if (elapsed < BASE_TIME) {
      displaySeconds = Math.ceil((BASE_TIME - elapsed) / 1000);
      isBonus = false;
    } else {
      const bonusUsed = elapsed - BASE_TIME;
      const bonusLeft = bonusRemaining - bonusUsed;
      displaySeconds = Math.ceil(Math.max(0, bonusLeft) / 1000);
      isBonus = true;

      // Timeout!
      if (bonusLeft <= 0) {
        this._stopOnlineTimer();
        if (this.onlineGame && this.onlineGame.myColor === currentPlayer) {
          this.onlineGame.timeoutLoss(currentPlayer);
        }
        return;
      }
    }

    // Update display
    this._renderTimer('white', currentPlayer === 'white' ? displaySeconds : null,
      currentPlayer === 'white' ? isBonus : false);
    this._renderTimer('black', currentPlayer === 'black' ? displaySeconds : null,
      currentPlayer === 'black' ? isBonus : false);
  }

  _renderTimer(color, seconds, isBonus) {
    const timerEl = document.getElementById('timer-' + color);
    if (!timerEl) return;

    const textEl = timerEl.querySelector('.timer-text');
    const progressEl = timerEl.querySelector('.timer-progress');
    const circumference = 106.81;

    if (seconds === null || seconds === undefined) {
      timerEl.classList.remove('timer-active', 'timer-bonus', 'timer-warning');
      if (textEl) textEl.textContent = '';
      if (progressEl) progressEl.style.strokeDashoffset = circumference;
      return;
    }

    timerEl.classList.add('timer-active');
    timerEl.classList.toggle('timer-bonus', !!isBonus);
    timerEl.classList.toggle('timer-warning', !!isBonus && seconds <= 10);

    if (textEl) textEl.textContent = seconds;

    const maxTime = isBonus ? 60 : 20;
    const fraction = Math.min(1, seconds / maxTime);
    const offset = circumference * (1 - fraction);
    if (progressEl) progressEl.style.strokeDashoffset = offset;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  _rand() { return Math.floor(Math.random() * 6) + 1; }
  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─── Bootstrap ─────────────────────────────────────────────────

let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new Game();
  game.init();

  // Fullscreen helper
  const _tryFullscreen = () => {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    try {
      if (el.requestFullscreen)            el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) {}
  };

  // Unlock audio
  const _soundUnlockOnce = () => {
    if (window.sounds) sounds.unlock();
    document.removeEventListener('click',      _soundUnlockOnce);
    document.removeEventListener('touchstart', _soundUnlockOnce);
  };
  document.addEventListener('click',      _soundUnlockOnce, { passive: true });
  document.addEventListener('touchstart', _soundUnlockOnce, { passive: true });

  document.addEventListener('click',      _tryFullscreen, { passive: true });
  document.addEventListener('touchstart', _tryFullscreen, { passive: true });

  window.addEventListener('orientationchange', () => setTimeout(_tryFullscreen, 400));
  if (screen.orientation) screen.orientation.addEventListener('change', () => setTimeout(_tryFullscreen, 400));

  const _u = () => { if (window.sounds) sounds.unlock(); };

  // ─── Menu buttons ──────────────────────────────────────────
  document.getElementById('btn-local').addEventListener('click', () => { _u(); _tryFullscreen(); game.showSetupScreen(); });
  document.getElementById('btn-ai').addEventListener('click', () => {
    _u(); _tryFullscreen();
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('ai-setup-screen').style.display = 'flex';
  });

  document.getElementById('btn-create-room').addEventListener('click', () => {
    _u();
    game.showRoomCreateScreen();
  });

  document.getElementById('btn-lobby').addEventListener('click', () => {
    _u();
    game.openLobby();
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    _u();
    const id = document.getElementById('room-id-input').value.trim();
    if (id) game.joinOnlineGame(id); else game.showGlobalNotification('Oda kodu girin!', 'warning', 2000);
  });

  // ─── Room Create Screen ───────────────────────────────────
  let _rcType = 'private';
  let _rcBet = 100;

  document.querySelectorAll('.rc-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rc-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _rcType = btn.dataset.type;
    });
  });

  document.querySelectorAll('.rc-bet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bet = parseInt(btn.dataset.bet);
      if (bet > APP_SETTINGS.coins) {
        game.showGlobalNotification('Yeterli coin yok!', 'warning', 2000);
        return;
      }
      document.querySelectorAll('.rc-bet-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _rcBet = bet;
    });
  });

  document.getElementById('rc-cancel').addEventListener('click', () => game.showMenu());
  document.getElementById('rc-create').addEventListener('click', () => {
    _u();
    const name = document.getElementById('rc-room-name').value.trim() || 'Oda';
    const vurkac = document.getElementById('rc-vurkac').checked;
    game.startOnlineCreateRoom({ name, type: _rcType, betAmount: _rcBet, vurkac });
  });

  // ─── Lobby Screen ─────────────────────────────────────────
  document.getElementById('lobby-back').addEventListener('click', () => game.showMenu());

  document.getElementById('lobby-search').addEventListener('input', () => {
    if (game.onlineGame && game.onlineGame.connected) {
      game.onlineGame.fetchLobby();
    }
  });

  document.getElementById('lobby-rooms-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.lrc-join-btn');
    if (!btn) return;
    const roomId = btn.dataset.roomId;
    const roomType = btn.dataset.roomType;
    if (roomType === 'invite') {
      game.onlineGame.requestJoinRoom(roomId);
    } else {
      game.onlineGame.joinRoom(roomId);
    }
  });

  document.getElementById('lobby-join-btn').addEventListener('click', () => {
    const code = document.getElementById('lobby-room-code').value.trim();
    if (code) game.joinOnlineGame(code);
    else game.showGlobalNotification('Oda kodu girin!', 'warning', 2000);
  });

  // ─── Waiting Room ─────────────────────────────────────────
  document.getElementById('wr-leave').addEventListener('click', () => {
    if (game.onlineGame) game.onlineGame.leaveRoom();
    game.showMenu();
  });

  document.getElementById('wr-ready').addEventListener('click', () => {
    game._wrReadyState = !game._wrReadyState;
    if (game.onlineGame) game.onlineGame.setReady(game._wrReadyState);
    const btn = document.getElementById('wr-ready');
    if (game._wrReadyState) {
      btn.textContent = 'Hazır Değilim';
      btn.classList.remove('primary-btn');
      btn.classList.add('secondary-btn');
    } else {
      btn.textContent = 'Hazırım';
      btn.classList.remove('secondary-btn');
      btn.classList.add('primary-btn');
    }
  });

  document.getElementById('wr-copy-code').addEventListener('click', () => {
    const code = document.getElementById('wr-room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      game.showGlobalNotification('Oda kodu kopyalandı!', 'success', 2000);
    }).catch(() => {});
  });

  // ─── Game buttons ─────────────────────────────────────────
  document.getElementById('roll-btn').addEventListener('click', () => { _u(); game.rollDice(); });
  document.getElementById('confirm-turn-btn').addEventListener('click', () => game.confirmTurnEnd());
  document.getElementById('undo-btn').addEventListener('click', () => game.undo());

  document.getElementById('double-btn').addEventListener('click', async () => {
    if (game.onlineGame) {
      // Check ownership before sending
      const cubeOwner = game._cubeState.owner;
      const myColor = game.onlineGame.myColor;
      if (cubeOwner !== null && cubeOwner !== myColor) {
        game.showToast('Bahis arttırma sırası rakipte');
        return;
      }
      // Disable button to prevent double-click
      const doubleBtn = document.getElementById('double-btn');
      const rollBtn = document.getElementById('roll-btn');
      doubleBtn.disabled = true;

      const success = await game.onlineGame.offerDouble();
      if (success) {
        // Firebase write succeeded — hide buttons, wait for opponent response
        game._cubeState.offered = true;
        doubleBtn.style.display = 'none';
        if (rollBtn) rollBtn.style.display = 'none';
        game.showToast('Bahis teklifi gönderildi...');
      } else {
        // Firebase write failed or ownership check failed — restore UI
        doubleBtn.disabled = false;
        game.showToast('Bahis teklifi gönderilemedi');
      }
    }
  });

  // Double response modal
  document.getElementById('double-accept').addEventListener('click', () => {
    const dm = document.getElementById('double-modal');
    dm.style.display = 'none';
    dm.style.zIndex = '';
    if (game.onlineGame) game.onlineGame.respondToDouble(true);
  });
  document.getElementById('double-decline').addEventListener('click', () => {
    const dm = document.getElementById('double-modal');
    dm.style.display = 'none';
    dm.style.zIndex = '';
    if (game.onlineGame) game.onlineGame.respondToDouble(false);
  });

  document.getElementById('resign-btn').addEventListener('click', async () => {
    const ok = await game.showModal('Teslim olmak istiyor musunuz?');
    if (ok) game.resign();
  });
  document.getElementById('new-game-btn').addEventListener('click', async () => {
    _u(); _tryFullscreen();
    if (game.state && game.state.phase !== PHASES.GAMEOVER) {
      const ok = await game.showModal('Mevcut oyunu bırakıp yeni oyun başlatmak istiyor musunuz?');
      if (!ok) return;
    }
    game.newGame();
  });
  document.getElementById('menu-btn').addEventListener('click', async () => {
    if (game.state && game.state.phase !== PHASES.GAMEOVER) {
      const ok = await game.showModal('Ana menüye dönmek istiyor musunuz?');
      if (!ok) return;
      // If online and game is active, resign first so opponent sees win
      if (game.state.gameMode === GAME_MODES.ONLINE && game.onlineGame) {
        game.onlineGame.resign();
      }
    }
    if (game.onlineGame && game.onlineGame.roomId) {
      game.onlineGame.leaveRoom();
    }
    game.showMenu();
  });

  document.getElementById('gameover-new-game').addEventListener('click', () => { _u(); _tryFullscreen(); game.newGame(); });
  document.getElementById('gameover-rematch').addEventListener('click', () => {
    _u();
    if (game.onlineGame && game.onlineGame.roomId) {
      game.onlineGame.requestRematch();
      const btn = document.getElementById('gameover-rematch');
      btn.disabled = true;
      btn.textContent = 'Rakip bekleniyor...';
      const statusEl = document.getElementById('gameover-rematch-status');
      const textEl = document.getElementById('gameover-rematch-text');
      if (statusEl && textEl) {
        textEl.textContent = 'Rakibin yanıtı bekleniyor...';
        statusEl.style.display = 'block';
      }
    }
  });
  document.getElementById('gameover-menu').addEventListener('click', () => {
    _u();
    if (game.onlineGame && game.onlineGame.roomId) {
      game.onlineGame.leaveRoom();
    }
    game.showMenu();
  });

  // ─── Global notification close ─────────────────────────────
  document.getElementById('global-notification-close').addEventListener('click', () => {
    document.getElementById('global-notification').style.display = 'none';
  });

  // ─── Setup screen (local game player config) ────────────────
  let _setupP1Color = PLAYERS.WHITE;

  const _updateSetupBadges = () => {
    const b1 = document.getElementById('setup-badge-1');
    const b2 = document.getElementById('setup-badge-2');
    if (_setupP1Color === PLAYERS.WHITE) {
      b1.className = 'player-color-badge white-badge';
      b2.className = 'player-color-badge black-badge';
    } else {
      b1.className = 'player-color-badge black-badge';
      b2.className = 'player-color-badge white-badge';
    }
  };
  _updateSetupBadges();

  document.getElementById('setup-shuffle').addEventListener('click', () => {
    _setupP1Color = _setupP1Color === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    _updateSetupBadges();
  });
  document.getElementById('setup-cancel').addEventListener('click', () => {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
  });
  document.getElementById('setup-start').addEventListener('click', () => {
    _u(); _tryFullscreen();
    const n1 = document.getElementById('setup-name-1').value.trim() || '1. Oyuncu';
    const n2 = document.getElementById('setup-name-2').value.trim() || '2. Oyuncu';
    const whiteName = _setupP1Color === PLAYERS.WHITE ? n1 : n2;
    const blackName = _setupP1Color === PLAYERS.BLACK ? n1 : n2;
    game.startLocalGame(whiteName, blackName);
  });

  // ─── AI Setup screen (color selection) ──────────────────────
  let _aiPlayerColor = PLAYERS.WHITE;

  const _updateAIBadges = () => {
    const bp = document.getElementById('ai-badge-player');
    const ba = document.getElementById('ai-badge-ai');
    if (_aiPlayerColor === PLAYERS.WHITE) {
      bp.className = 'player-color-badge white-badge';
      ba.className = 'player-color-badge black-badge';
    } else {
      bp.className = 'player-color-badge black-badge';
      ba.className = 'player-color-badge white-badge';
    }
  };
  _updateAIBadges();

  document.getElementById('ai-shuffle').addEventListener('click', () => {
    _aiPlayerColor = _aiPlayerColor === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    _updateAIBadges();
  });
  document.getElementById('ai-cancel').addEventListener('click', () => {
    document.getElementById('ai-setup-screen').style.display = 'none';
    document.getElementById('menu-screen').style.display = 'flex';
  });
  document.getElementById('ai-start').addEventListener('click', () => {
    _u(); _tryFullscreen();
    document.getElementById('ai-setup-screen').style.display = 'none';
    game.startAIGame(AI_DIFFICULTY.HARD, _aiPlayerColor);
  });

  // ─── Settings modal ─────────────────────────────────────────
  const settingsModal = document.getElementById('settings-modal');
  const toggleSound   = document.getElementById('toggle-sound');
  const toggleVurkac  = document.getElementById('toggle-vurkac');

  toggleSound.checked  = APP_SETTINGS.sound;
  toggleVurkac.checked = APP_SETTINGS.vurkac;

  // Show nickname in settings
  const smNickVal = document.getElementById('sm-nickname-val');
  if (smNickVal) smNickVal.textContent = APP_SETTINGS.nickname || 'Anonim';

  if (window.sounds) sounds.enabled = APP_SETTINGS.sound;

  const vurkacRow     = document.getElementById('toggle-vurkac').closest('.sm-row');
  const vurkacDivider = vurkacRow.previousElementSibling;

  const nickRow     = document.getElementById('sm-nickname-row');
  const nickDivider = document.getElementById('sm-nickname-divider');

  const openSettings = (fromGame = false) => {
    const hide = fromGame ? 'none' : '';
    vurkacRow.style.display = hide;
    if (vurkacDivider) vurkacDivider.style.display = hide;
    // Hide nickname row during online game
    const isOnlineGame = game.state && game.state.gameMode === GAME_MODES.ONLINE && game.state.phase !== PHASES.GAMEOVER;
    const hideNick = (fromGame && isOnlineGame) ? 'none' : '';
    if (nickRow) nickRow.style.display = hideNick;
    if (nickDivider) nickDivider.style.display = hideNick;
    settingsModal.style.display = 'flex';
  };
  const closeSettings = () => { settingsModal.style.display = 'none'; };

  document.getElementById('settings-btn').addEventListener('click', () => openSettings(false));
  document.getElementById('settings-game-btn').addEventListener('click', () => openSettings(true));
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', closeSettings);

  document.getElementById('sm-nickname-edit').addEventListener('click', () => {
    // Don't allow nickname change during online game
    if (game.state && game.state.gameMode === GAME_MODES.ONLINE && game.state.phase !== PHASES.GAMEOVER) {
      game.showGlobalNotification('Oyun sırasında takma ad değiştirilemez!', 'warning', 2000);
      return;
    }
    closeSettings();
    game.showNicknameModal((nick) => {
      smNickVal.textContent = nick;
    });
  });

  toggleSound.addEventListener('change', () => {
    APP_SETTINGS.sound = toggleSound.checked;
    if (window.sounds) sounds.enabled = toggleSound.checked;
  });

  toggleVurkac.addEventListener('change', () => {
    APP_SETTINGS.vurkac = toggleVurkac.checked;
    if (game.state && game.state.phase === PHASES.MOVING) {
      game.updateValidMoves();
    }
  });
});
