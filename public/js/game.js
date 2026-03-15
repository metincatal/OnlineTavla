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
    this.playerNames = { white: 'Beyaz', black: 'Siyah' };
  }

  init() {
    this.boardRenderer = new Board('board-svg');
    this.boardRenderer.onPointClick = (point) => this.handlePointClick(point);
    this.boardRenderer.onPieceHover = (point) => this.handlePieceHover(point);
    this.boardRenderer.onDropMove   = (from, to) => this.handleDrop(from, to);
    this.diceManager = new DiceManager();
    this.showMenu();
  }

  showMenu() {
    document.getElementById('menu-screen').style.display = 'flex';
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'none';
  }

  showSetupScreen() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'flex';
  }

  startLocalGame(whitePlayerName, blackPlayerName) {
    this.playerNames.white = whitePlayerName || 'Beyaz';
    this.playerNames.black = blackPlayerName || 'Siyah';
    this.initState(GAME_MODES.LOCAL);
    this.showGame();
    this.beginInitialRoll();
  }

  startAIGame(difficulty) {
    this.ai = new BackgammonAI(difficulty || AI_DIFFICULTY.HARD);
    this.initState(GAME_MODES.AI);
    this.showGame();
    this.beginInitialRoll();
  }

  startOnlineGame() {
    if (!this.onlineGame) this.onlineGame = new OnlineGame(this);
    this.onlineGame.createRoom();
  }

  joinOnlineGame(roomId) {
    if (!this.onlineGame) this.onlineGame = new OnlineGame(this);
    this.onlineGame.joinRoom(roomId.toUpperCase());
  }

  initState(mode) {
    this.bearOffCounts = { white: 0, black: 0 };
    this.moveHistory = [];
    this.confirmPending = false;
    this._hadChoice = false; // player made at least one chosen move this turn
    this._vurkacLockedPoint = null; // vur-kaç: point that hit in own home this turn
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

  showGame() {
    document.getElementById('menu-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('gameover-screen').style.display = 'none';
    this.renderAll();
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

    // 3D zar animasyonu (ses animasyon içinde ilk sekmede çalar)
    await this.diceManager.animateRoll([w, b], 600, 'white');

    // VS karşılaştırma overlay
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

    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === PLAYERS.BLACK) {
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
      this.onlineGame.rollDice();
      return;
    }

    const dice = rollDice();
    const expanded = expandDice(dice);

    // Ses animasyon içinde ilk sekmede çalar
    await this.diceManager.animateRoll(expanded, 450, this.state.currentPlayer);

    this.state.dice = expanded;
    this.state.remainingDice = [...expanded];
    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();

    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === PLAYERS.BLACK) {
      setTimeout(() => this.doAITurn(), 500);
    } else {
      this._checkAutoPlay();
    }
  }

  // ─── Click handler ─────────────────────────────────────────────

  handlePointClick(point) {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.confirmPending) return;

    const { currentPlayer, board, gameMode } = this.state;
    if (gameMode === GAME_MODES.ONLINE && !this.onlineGame.isMyTurn(currentPlayer)) return;
    if (gameMode === GAME_MODES.AI && currentPlayer === PLAYERS.BLACK) return;

    // Vur-kaç: kilitli pula tıklamayı engelle
    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && point === this._vurkacLockedPoint) {
      this.showToast('Bu pul bu tur hareket edemez');
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

  handleDrop(from, to) {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.confirmPending) return;

    const { currentPlayer, gameMode } = this.state;
    if (gameMode === GAME_MODES.ONLINE && !this.onlineGame.isMyTurn(currentPlayer)) return;
    if (gameMode === GAME_MODES.AI && currentPlayer === PLAYERS.BLACK) return;

    // Vur-kaç: kilitli pulun sürükle-bırakını engelle
    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && from === this._vurkacLockedPoint) {
      this.showToast('Bu pul bu tur hareket edemez');
      return;
    }

    // Single-die move
    const moves = this.state.validMoves.filter(m => m.from === from && m.to === to);
    if (moves.length > 0) {
      const bestMove = moves.reduce((a, b) => a.die < b.die ? a : b);
      this.applyPlayerMove(bestMove);
      return;
    }

    // Multi-die sequence (ghost destination with combined dice)
    const sequence = this._findMoveSequence(
      from, to, [...this.state.board], [...this.state.remainingDice]
    );
    if (sequence && sequence.length > 0) {
      this._applyMoveSequence(sequence);
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
          // Vur-kaç: ara hamle kendi evinde vuruyorsa bu yol kullanılamaz
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

  _applyMoveSequence(sequence) {
    this._hadChoice = true;
    this.pushHistory(); // single undo point for the whole sequence

    for (const move of sequence) {
      const { currentPlayer } = this.state;
      const isWhiteSeq = currentPlayer === PLAYERS.WHITE;
      const isHitSeq = this.state.board[move.to] === (isWhiteSeq ? -1 : 1);

      if ((currentPlayer === PLAYERS.WHITE && move.to === 25) ||
          (currentPlayer === PLAYERS.BLACK && move.to === 0)) {
        this.bearOffCounts[currentPlayer]++;
        if (window.sounds) sounds.play('bearoff');
      } else if (isHitSeq) {
        if (window.sounds) sounds.play('hit');
      } else {
        if (window.sounds) sounds.play('move');
      }

      // Vur-kaç kuralı: sekans içinde kendi evinde vurma
      if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && isHitSeq) {
        const homeStart = isWhiteSeq ? 19 : 1;
        const homeEnd   = isWhiteSeq ? 24 : 6;
        if (move.to >= homeStart && move.to <= homeEnd) {
          this._vurkacLockedPoint = move.to;
        }
      }

      if (this.state.gameMode === GAME_MODES.ONLINE) this.onlineGame.makeMove(move);
      this.state.board = applyMove(this.state.board, move, currentPlayer);
      this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);

      if (isGameOver(this.state.board)) {
        const winner = getWinner(this.state.board);
        if (window.sounds) sounds.play('gameover');
        this.renderAll();
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
    const { currentPlayer, gameMode, board, remainingDice } = this.state;
    if (gameMode === GAME_MODES.AI && currentPlayer === PLAYERS.BLACK) return;

    // Vur-kaç: kilitli pul üzerinde ghost highlight gösterme
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

    const results = new Map(); // dest → diceSum

    const recurse = (curBoard, curFrom, diceLeft, sumSoFar) => {
      const unique = [...new Set(diceLeft)];
      for (const die of unique) {
        const curHasBar = curBoard[barIndex] !== 0;
        const movesForDie = getMovesForDie(curBoard, player, die, curHasBar, isWhite)
          .filter(m => m.from === curFrom);

        for (const move of movesForDie) {
          const newSum = sumSoFar + die;
          if (!results.has(move.to)) results.set(move.to, newSum);

          // Vur-kaç: kendi evinde vurma → bu noktadan sonra ghost hesaplama
          if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac) {
            const isHit = curBoard[move.to] === (isWhite ? -1 : 1);
            if (isHit) {
              const homeStart = isWhite ? 19 : 1;
              const homeEnd   = isWhite ? 24 : 6;
              if (typeof move.to === 'number' && move.to >= homeStart && move.to <= homeEnd) {
                continue; // destination added but no further recursion
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
    if (this.state.gameMode === GAME_MODES.ONLINE) return;

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
  }

  // ─── Apply a move ─────────────────────────────────────────────

  applyPlayerMove(move) {
    const { currentPlayer } = this.state;

    this._hadChoice = true; // player made an explicit choice
    this.pushHistory();

    const isWhitePlayer = currentPlayer === PLAYERS.WHITE;
    const isHit = this.state.board[move.to] === (isWhitePlayer ? -1 : 1);

    if ((currentPlayer === PLAYERS.WHITE && move.to === 25) ||
        (currentPlayer === PLAYERS.BLACK && move.to === 0)) {
      this.bearOffCounts[currentPlayer]++;
      if (window.sounds) sounds.play('bearoff');
    } else if (isHit) {
      if (window.sounds) sounds.play('hit');
    } else {
      if (window.sounds) sounds.play('move');
    }

    // Vur-kaç kuralı: kendi evinde vuruyorsa o pul bu tur kilitlenir
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
      this.onlineGame.makeMove(move);
    }

    if (isGameOver(this.state.board)) {
      const winner = getWinner(this.state.board);
      const gameType = getGameType(this.state.board, winner);
      if (window.sounds) sounds.play('gameover');
      this.endGame(winner, gameType);
      return;
    }

    this.updateValidMoves();
    this.renderAll();

    if (this.state.remainingDice.length === 0) {
      // Player used all dice by choice → confirm button
      this._showConfirmButton();
    } else {
      // Check if remaining dice have forced or no moves
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
    let moves = generateValidMoves(
      this.state.board, this.state.currentPlayer, this.state.remainingDice
    );
    // Vur-kaç kuralı: kendi evinde vurmuşsa o pul artık hareket edemez
    if (window.APP_SETTINGS && window.APP_SETTINGS.vurkac && this._vurkacLockedPoint !== null) {
      moves = moves.filter(m => m.from !== this._vurkacLockedPoint);
    }
    this.state.validMoves = moves;
  }

  // ─── Turn end ─────────────────────────────────────────────────

  endTurn() {
    this.moveHistory = [];
    this.confirmPending = false;
    this._hadChoice = false;
    this._vurkacLockedPoint = null;

    this.state.currentPlayer = this.state.currentPlayer === PLAYERS.WHITE
      ? PLAYERS.BLACK : PLAYERS.WHITE;
    this.state.dice = [];
    this.state.remainingDice = [];
    this.state.validMoves = [];
    this.state.phase = PHASES.ROLLING;
    this.updateUI();
    this.renderAll();

    if (this.state.gameMode !== GAME_MODES.ONLINE) {
      setTimeout(() => this.rollDice(), 1000);
    }
  }

  // ─── Auto-play forced moves ────────────────────────────────────

  async _checkAutoPlay() {
    if (this.state.phase !== PHASES.MOVING) return;
    if (this.state.gameMode === GAME_MODES.ONLINE) return;
    if (this.state.gameMode === GAME_MODES.AI && this.state.currentPlayer === PLAYERS.BLACK) return;

    const moves = this.state.validMoves;

    if (moves.length === 0) {
      if (this._hadChoice) {
        // Player made some choices this turn; let them review/undo before passing
        this._showConfirmButton();
      } else {
        await this.delay(450);
        if (this.state.phase === PHASES.MOVING) this.endTurn();
      }
      return;
    }

    const uniquePairs = new Set(moves.map(m => `${m.from}-${m.to}`));
    if (uniquePairs.size > 1) {
      this.updateUI(); // multiple choices, player decides
      return;
    }

    // Only one destination possible → forced move
    await this.delay(350);
    if (this.state.phase !== PHASES.MOVING) return;

    const move = moves.reduce((a, b) => a.die < b.die ? a : b); // use smallest die
    this._applyForcedMove(move);
  }

  _applyForcedMove(move) {
    const { currentPlayer } = this.state;

    if ((currentPlayer === PLAYERS.WHITE && move.to === 25) ||
        (currentPlayer === PLAYERS.BLACK && move.to === 0)) {
      this.bearOffCounts[currentPlayer]++;
      if (window.sounds) sounds.play('bearoff');
    } else if (this.state.board[move.to] === (currentPlayer === PLAYERS.WHITE ? -1 : 1)) {
      if (window.sounds) sounds.play('hit');
    } else {
      if (window.sounds) sounds.play('move');
    }

    this.state.board = applyMove(this.state.board, move, currentPlayer);
    this.state.remainingDice = getDiceAfterMove(this.state.remainingDice, move.die);

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
        // Player made some choices this turn → let them review/undo
        this._showConfirmButton();
      } else {
        // Entire turn was forced → auto end
        setTimeout(() => { if (this.state.phase === PHASES.MOVING) this.endTurn(); }, 450);
      }
    } else {
      setTimeout(() => this._checkAutoPlay(), 350);
    }
  }

  // ─── AI turn — visible step-by-step ──────────────────────────

  async doAITurn() {
    if (this.state.currentPlayer !== PLAYERS.BLACK) return;
    if (this.state.phase !== PHASES.MOVING) return;

    const bestMoves = this.ai.getBestMoves(
      this.state.board, PLAYERS.BLACK, this.state.remainingDice
    );

    if (bestMoves.length === 0) {
      setTimeout(() => this.endTurn(), 400);
      return;
    }

    this.showStatusMessage('Bilgisayar oynuyor...');
    await this.delay(350);

    for (const move of bestMoves) {
      const fromLabel = move.from === 25 ? 'Bar' : `${move.from}. nokta`;
      const toLabel   = move.to   === 0  ? 'Çıkış' : `${move.to}. nokta`;
      this.showStatusMessage(`▶ ${fromLabel} → ${toLabel}`);

      this.boardRenderer.flashPoint(move.from, '#FFD700');
      await this.delay(480);

      if (move.to === 0) {
        this.bearOffCounts[PLAYERS.BLACK]++;
        if (window.sounds) sounds.play('bearoff');
      } else if (this.state.board[move.to] === 1) {
        if (window.sounds) sounds.play('hit');
      } else {
        if (window.sounds) sounds.play('move');
      }

      this.state.board = applyMove(this.state.board, move, PLAYERS.BLACK);
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

  endGame(winner, gameType) {
    this.state.phase = PHASES.GAMEOVER;
    this.confirmPending = false;
    this._hideConfirmButton();
    this.renderAll();

    const labels = { normal: '', gammon: ' (Gamen!)', backgammon: ' (Backgammon!)', resign: ' (Teslim)' };
    const winnerLabel = winner === PLAYERS.WHITE
      ? this.playerNames.white
      : this.playerNames.black;
    document.getElementById('gameover-title').textContent = `${winnerLabel} Kazandı!${labels[gameType] || ''}`;
    const points = gameType === 'backgammon' ? 3 : gameType === 'gammon' ? 2 : 1;
    document.getElementById('gameover-points').textContent = `${points} puan`;
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

  loadOnlineState(gameState, myColor) {
    this.initState(GAME_MODES.ONLINE);
    this.state.board = gameState.board;
    this.state.currentPlayer = gameState.currentPlayer;
    this.state.phase = PHASES.ROLLING;
    this.showGame();
    this.updateUI();
    this.renderAll();
  }

  onlineRollReceived(dice, player) {
    this.state.dice = expandDice(dice);
    this.state.remainingDice = [...this.state.dice];
    this.state.phase = PHASES.MOVING;
    this.updateValidMoves();
    this.updateUI();
    this.renderAll();
  }

  onlineMoveReceived(gameState, move) {
    this.state.board = gameState.board;
    this.state.remainingDice = gameState.remainingDice;
    this.updateValidMoves();
    this.renderAll();
  }

  onlineTurnChanged(currentPlayer) {
    this.state.currentPlayer = currentPlayer;
    this.state.phase = PHASES.ROLLING;
    this.state.dice = [];
    this.state.remainingDice = [];
    this.state.validMoves = [];
    this.updateUI();
    this.renderAll();
  }

  onlineGameOver(winner, type) { this.endGame(winner, type); }
  onlinePlayerLeft() {
    document.getElementById('gameover-title').textContent = 'Rakip Ayrıldı';
    document.getElementById('gameover-screen').style.display = 'flex';
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
    const isAITurn = gameMode === GAME_MODES.AI && currentPlayer === PLAYERS.BLACK;
    const isOnline = gameMode === GAME_MODES.ONLINE;

    // Roll button: only visible in online mode
    const rollBtn = document.getElementById('roll-btn');
    if (rollBtn) {
      if (isOnline) {
        const myTurn = this.onlineGame && this.onlineGame.isMyTurn(currentPlayer);
        rollBtn.style.display = (phase === PHASES.ROLLING && myTurn) ? '' : 'none';
        rollBtn.textContent = '🎲 Zar At';
        rollBtn.disabled = false;
      } else {
        rollBtn.style.display = 'none';
      }
    }

    // Undo button: show after first move, non-online, non-AI-turn, while moving
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      const showUndo = !isAITurn && !isOnline &&
        phase === PHASES.MOVING && this.moveHistory.length > 0;
      undoBtn.style.display = showUndo ? '' : 'none';
    }

    // Confirm (✓) button: show when confirmPending
    const confirmBtn = document.getElementById('confirm-turn-btn');
    if (confirmBtn) {
      confirmBtn.style.display = this.confirmPending ? '' : 'none';
    }

    // Side panel active-turn highlight
    const panelWhite = document.getElementById('panel-white');
    const panelBlack = document.getElementById('panel-black');
    if (panelWhite) panelWhite.classList.toggle('active-turn', currentPlayer === PLAYERS.WHITE && phase === PHASES.MOVING);
    if (panelBlack) panelBlack.classList.toggle('active-turn', currentPlayer === PLAYERS.BLACK && phase === PHASES.MOVING);

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
  }

  showStatusMessage(msg) { /* no-op */ }

  showToast(msg) {
    const el = document.getElementById('game-toast');
    if (!el) return;
    clearTimeout(this._toastTimer);
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    void el.offsetWidth; // reflow to restart animation
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2000);
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

  // Fullscreen helper — fires on any user gesture when in landscape (mobile/Android only)
  const _tryFullscreen = () => {
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    if (document.fullscreenElement) return; // already fullscreen
    const el = document.documentElement;
    try {
      if (el.requestFullscreen)            el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (_) {}
  };

  // Unlock audio exactly once (must be in gesture chain)
  const _soundUnlockOnce = () => {
    if (window.sounds) sounds.unlock();
    document.removeEventListener('click',      _soundUnlockOnce);
    document.removeEventListener('touchstart', _soundUnlockOnce);
  };
  document.addEventListener('click',      _soundUnlockOnce, { passive: true });
  document.addEventListener('touchstart', _soundUnlockOnce, { passive: true });

  // Try fullscreen on EVERY click/touch (guard inside prevents repeat calls)
  document.addEventListener('click',      _tryFullscreen, { passive: true });
  document.addEventListener('touchstart', _tryFullscreen, { passive: true });

  // Also try on orientation change
  window.addEventListener('orientationchange', () => setTimeout(_tryFullscreen, 400));
  if (screen.orientation) screen.orientation.addEventListener('change', () => setTimeout(_tryFullscreen, 400));

  // Game buttons — unlock sounds eagerly in each handler for reliable audio
  const _u = () => { if (window.sounds) sounds.unlock(); };

  document.getElementById('btn-local').addEventListener('click', () => { _u(); _tryFullscreen(); game.showSetupScreen(); });
  document.getElementById('btn-ai').addEventListener('click', () => { _u(); _tryFullscreen(); game.startAIGame(AI_DIFFICULTY.HARD); });
  document.getElementById('btn-create-room').addEventListener('click', () => { _u(); game.startOnlineGame(); });
  document.getElementById('btn-join-room').addEventListener('click', () => {
    _u();
    const id = document.getElementById('room-id-input').value.trim();
    if (id) game.joinOnlineGame(id); else alert('Oda kodu girin!');
  });

  document.getElementById('roll-btn').addEventListener('click', () => { _u(); game.rollDice(); });
  document.getElementById('confirm-turn-btn').addEventListener('click', () => game.confirmTurnEnd());
  document.getElementById('undo-btn').addEventListener('click', () => game.undo());

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
    }
    game.showMenu();
  });

  document.getElementById('gameover-new-game').addEventListener('click', () => { _u(); _tryFullscreen(); game.newGame(); });
  document.getElementById('gameover-menu').addEventListener('click', () => { _u(); game.showMenu(); });

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

  // ─── Settings modal ─────────────────────────────────────────
  const settingsModal = document.getElementById('settings-modal');
  const toggleSound   = document.getElementById('toggle-sound');
  const toggleVurkac  = document.getElementById('toggle-vurkac');

  // Init checkboxes from stored settings
  toggleSound.checked  = APP_SETTINGS.sound;
  toggleVurkac.checked = APP_SETTINGS.vurkac;

  // Sync sound enabled state on load
  if (window.sounds) sounds.enabled = APP_SETTINGS.sound;

  const vurkacRow     = document.getElementById('toggle-vurkac').closest('.sm-row');
  const vurkacDivider = vurkacRow.previousElementSibling; // .sm-divider

  const openSettings = (fromGame = false) => {
    // Oyun içinde vur-kaç kuralı ayarını gizle
    const hide = fromGame ? 'none' : '';
    vurkacRow.style.display = hide;
    if (vurkacDivider) vurkacDivider.style.display = hide;
    settingsModal.style.display = 'flex';
  };
  const closeSettings = () => { settingsModal.style.display = 'none'; };

  document.getElementById('settings-btn').addEventListener('click', () => openSettings(false));
  document.getElementById('settings-game-btn').addEventListener('click', () => openSettings(true));
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('settings-backdrop').addEventListener('click', closeSettings);

  toggleSound.addEventListener('change', () => {
    APP_SETTINGS.sound = toggleSound.checked;
    if (window.sounds) sounds.enabled = toggleSound.checked;
  });

  toggleVurkac.addEventListener('change', () => {
    APP_SETTINGS.vurkac = toggleVurkac.checked;
    // Recalculate valid moves immediately if in MOVING phase
    if (game.state && game.state.phase === PHASES.MOVING) {
      game.updateValidMoves();
    }
  });
});
