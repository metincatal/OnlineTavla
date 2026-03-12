// Heuristic AI for Backgammon (Phase 2)
// White moves 1→24 (home 19-24), Black moves 24→1 (home 1-6)

class BackgammonAI {
  constructor(difficulty = AI_DIFFICULTY.MEDIUM) {
    this.difficulty = difficulty;
  }

  getBestMoves(board, player, dice) {
    const expanded = expandDice(dice);
    return this.findBestSequence(board, player, expanded, []);
  }

  findBestSequence(board, player, remainingDice, movesSoFar) {
    if (remainingDice.length === 0) return movesSoFar;

    const validMoves = generateValidMoves(board, player, remainingDice);
    if (validMoves.length === 0) return movesSoFar;

    if (this.difficulty === AI_DIFFICULTY.EASY && Math.random() < 0.35) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      const newBoard = applyMove(board, randomMove, player);
      const remainingDiceAfter = getDiceAfterMove(remainingDice, randomMove.die);
      return this.findBestSequence(newBoard, player, remainingDiceAfter, [...movesSoFar, randomMove]);
    }

    let bestScore = -Infinity;
    let bestMove = null;
    let bestBoard = null;
    let bestRemaining = null;

    for (const move of validMoves) {
      const newBoard = applyMove(board, move, player);
      const remaining = getDiceAfterMove(remainingDice, move.die);

      let score;
      if (this.difficulty === AI_DIFFICULTY.HARD && remaining.length > 0) {
        score = this.evaluateWithLookahead(newBoard, player, remaining);
      } else {
        score = this.evaluateBoard(newBoard, player);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        bestBoard = newBoard;
        bestRemaining = remaining;
      }
    }

    return this.findBestSequence(bestBoard, player, bestRemaining, [...movesSoFar, bestMove]);
  }

  evaluateWithLookahead(board, player, remainingDice) {
    const moves = generateValidMoves(board, player, remainingDice);
    if (moves.length === 0) return this.evaluateBoard(board, player);

    let bestScore = -Infinity;
    for (const move of moves) {
      const newBoard = applyMove(board, move, player);
      const score = this.evaluateBoard(newBoard, player);
      if (score > bestScore) bestScore = score;
    }
    return bestScore;
  }

  evaluateBoard(board, player) {
    const isBlack = player === PLAYERS.BLACK;
    let score = 0;

    // 1. Pip count advantage
    const myPip = getPipCount(board, player);
    const oppPlayer = isBlack ? PLAYERS.WHITE : PLAYERS.BLACK;
    const oppPip = getPipCount(board, oppPlayer);
    score += (oppPip - myPip) * 2;

    // 2. Blot penalty (single exposed pieces)
    for (let i = 1; i <= 24; i++) {
      if (isBlack && board[i] === -1) score -= 12;
      if (!isBlack && board[i] === 1) score -= 12;
    }

    // 3. Prime building (consecutive blocked points)
    const myPoints = [];
    for (let i = 1; i <= 24; i++) {
      if (isBlack && board[i] <= -2) myPoints.push(i);
      if (!isBlack && board[i] >= 2) myPoints.push(i);
    }
    let maxPrime = 0, currentPrime = 0;
    for (let i = 1; i <= 24; i++) {
      if (myPoints.includes(i)) {
        currentPrime++;
        maxPrime = Math.max(maxPrime, currentPrime);
      } else {
        currentPrime = 0;
      }
    }
    score += maxPrime * 8;

    // 4. Opponent blots remaining
    for (let i = 1; i <= 24; i++) {
      if (isBlack && board[i] === 1) score -= 5;
      if (!isBlack && board[i] === -1) score -= 5;
    }

    // 5. Bar penalty
    if (isBlack) {
      score -= Math.abs(board[25]) * 15;
    } else {
      score -= board[0] * 15;
    }

    // 6. Home board safety
    // Black home: 1-6, White home: 19-24
    if (isBlack) {
      for (let i = 1; i <= 6; i++) {
        if (board[i] <= -2) score += 5;
      }
    } else {
      for (let i = 19; i <= 24; i++) {
        if (board[i] >= 2) score += 5;
      }
    }

    // 7. Bearing off progress
    if (isBearingOff(board, player)) {
      score += 50;
    }

    return score;
  }
}
