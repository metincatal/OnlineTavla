// Tavla (Backgammon) Game Logic Engine
//
// Direction:
//   White moves 1 → 24 (clockwise). Home board: points 19-24. Bears off to "25".
//   Black moves 24 → 1 (counter-clockwise). Home board: points 1-6. Bears off to "0".
//
// Board array indices:
//   board[0]  = white bar (positive count)
//   board[1..24] = points (positive = white pieces, negative = black pieces)
//   board[25] = black bar (negative count)

/**
 * Returns all valid moves for the given player with the given dice.
 * A move is { from, to, die }.
 *   White bears off: to = 25
 *   Black bears off: to = 0
 */
function generateValidMoves(board, player, remainingDice) {
  if (!remainingDice || remainingDice.length === 0) return [];

  const isWhite = player === PLAYERS.WHITE;
  const barIndex = isWhite ? 0 : 25;
  const hasBar = board[barIndex] !== 0;

  const uniqueDice = [...new Set(remainingDice)];
  let allMoves = [];

  for (const die of uniqueDice) {
    const moves = getMovesForDie(board, player, die, hasBar, isWhite);
    allMoves = allMoves.concat(moves);
  }

  // Remove duplicates
  const seen = new Set();
  allMoves = allMoves.filter(m => {
    const key = `${m.from}-${m.to}-${m.die}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return allMoves;
}

function getMovesForDie(board, player, die, hasBar, isWhite) {
  const moves = [];

  if (hasBar) {
    const barIndex = isWhite ? 0 : 25;
    // White on bar enters at die (1-6, opponent's home 1-6)
    // Black on bar enters at 25-die (24 down to 19, opponent's home 19-24)
    const entryPoint = isWhite ? die : 25 - die;
    if (canLand(board, player, entryPoint)) {
      moves.push({ from: barIndex, to: entryPoint, die });
    }
    return moves;
  }

  const canBearOff = isBearingOff(board, player);

  for (let i = 1; i <= 24; i++) {
    const hasPiece = isWhite ? board[i] > 0 : board[i] < 0;
    if (!hasPiece) continue;

    if (isWhite) {
      // White moves toward higher numbers (1 → 24)
      const target = i + die;
      if (target <= 24) {
        if (canLand(board, player, target)) {
          moves.push({ from: i, to: target, die });
        }
      } else if (canBearOff) {
        // target > 24: exact (target===25) or overshoot from highest point
        if (target === 25 || isHighestPoint(board, player, i)) {
          moves.push({ from: i, to: 25, die });
        }
      }
    } else {
      // Black moves toward lower numbers (24 → 1)
      const target = i - die;
      if (target >= 1) {
        if (canLand(board, player, target)) {
          moves.push({ from: i, to: target, die });
        }
      } else if (canBearOff) {
        // target < 1: exact (target===0) or overshoot from highest point
        if (target === 0 || isHighestPoint(board, player, i)) {
          moves.push({ from: i, to: 0, die });
        }
      }
    }
  }

  return moves;
}

function canLand(board, player, point) {
  if (point < 1 || point > 24) return false;
  const isWhite = player === PLAYERS.WHITE;
  const val = board[point];
  if (isWhite) {
    return val >= -1; // empty, own piece, or single opponent (hit)
  } else {
    return val <= 1;
  }
}

/**
 * For bearing off with an overshooting die:
 *   White: highest occupied = largest index in home (19-24)
 *   Black: highest occupied = smallest index in home (1-6)
 */
function isHighestPoint(board, player, point) {
  const isWhite = player === PLAYERS.WHITE;
  if (isWhite) {
    // White home 19-24, bears off toward 25.
    // "Highest point" = most pips from exit = SMALLEST index (point 19 = 6-point, farthest from exit).
    // Overshoot rule: bear off from the point with the most remaining pips.
    for (let i = 19; i <= 24; i++) {
      if (board[i] > 0) return i === point;
    }
  } else {
    // Black home 1-6, bears off toward 0.
    // "Highest point" = most pips from exit = LARGEST index (point 6 = 6-point, farthest from exit).
    for (let i = 6; i >= 1; i--) {
      if (board[i] < 0) return i === point;
    }
  }
  return false;
}

/**
 * Returns true if the player has all pieces in their home board (ready to bear off).
 *   White home: 19-24
 *   Black home: 1-6
 */
function isBearingOff(board, player) {
  const isWhite = player === PLAYERS.WHITE;
  if (isWhite) {
    if (board[0] > 0) return false; // piece on white bar
    for (let i = 1; i <= 18; i++) {
      if (board[i] > 0) return false;
    }
    return true;
  } else {
    if (board[25] < 0) return false; // piece on black bar
    for (let i = 7; i <= 24; i++) {
      if (board[i] < 0) return false;
    }
    return true;
  }
}

/**
 * Apply a move and return the new board state.
 */
function applyMove(board, move, player) {
  const newBoard = [...board];
  const isWhite = player === PLAYERS.WHITE;
  const { from, to } = move;

  // Remove piece from source
  if (isWhite) {
    newBoard[from]--;
  } else {
    newBoard[from]++;
  }

  // Handle bearing off (white → 25, black → 0)
  if (isWhite && to === 25) return newBoard;
  if (!isWhite && to === 0) return newBoard;

  // Check for hit
  if (isWhite && newBoard[to] === -1) {
    newBoard[to] = 0;
    newBoard[25]--; // Black goes to bar
  } else if (!isWhite && newBoard[to] === 1) {
    newBoard[to] = 0;
    newBoard[0]++; // White goes to bar
  }

  // Place piece at destination
  if (isWhite) {
    newBoard[to]++;
  } else {
    newBoard[to]--;
  }

  return newBoard;
}

/**
 * Check if opponent's home board is fully blocked ("okullar kapalı").
 * If a player has all 6 points in their home covered (2+ pieces),
 * the opponent on the bar cannot enter.
 *   player = the player whose home we check
 *   Returns true if all 6 home points are blocked by that player.
 */
function isSchoolClosed(board, player) {
  const isWhite = player === PLAYERS.WHITE;
  if (isWhite) {
    // White's home: 19-24. Check if all blocked by white (2+ pieces).
    for (let i = 19; i <= 24; i++) {
      if (board[i] < 2) return false;
    }
  } else {
    // Black's home: 1-6. Check if all blocked by black (2+ pieces).
    for (let i = 1; i <= 6; i++) {
      if (board[i] > -2) return false;
    }
  }
  return true;
}

/**
 * Check if the game is over (all pieces borne off).
 */
function isGameOver(board) {
  return getWinner(board) !== null;
}

function getWinner(board) {
  let whiteCount = 0;
  let blackCount = 0;
  for (let i = 0; i <= 25; i++) {
    if (board[i] > 0) whiteCount += board[i];
    if (board[i] < 0) blackCount += Math.abs(board[i]);
  }
  if (whiteCount === 0) return PLAYERS.WHITE;
  if (blackCount === 0) return PLAYERS.BLACK;
  return null;
}

/**
 * Determine game type: normal, gammon, backgammon
 */
function getGameType(board, winner) {
  const loser = winner === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
  const isLoserBlack = loser === PLAYERS.BLACK;

  let piecesOnBoard = 0;
  let piecesInWinnerHome = 0;
  let piecesOnBar = 0;

  for (let i = 1; i <= 24; i++) {
    if (isLoserBlack && board[i] < 0) {
      piecesOnBoard += Math.abs(board[i]);
      // White wins, so winner's home is 19-24
      if (i >= 19 && i <= 24) piecesInWinnerHome += Math.abs(board[i]);
    } else if (!isLoserBlack && board[i] > 0) {
      piecesOnBoard += board[i];
      // Black wins, so winner's home is 1-6
      if (i >= 1 && i <= 6) piecesInWinnerHome += board[i];
    }
  }

  if (isLoserBlack) {
    piecesOnBar = Math.abs(board[25]);
  } else {
    piecesOnBar = board[0];
  }

  if (piecesOnBar > 0 || piecesInWinnerHome > 0) return 'backgammon';
  if (piecesOnBoard > 0) return 'gammon';
  return 'normal';
}

/**
 * Compute the maximum number of dice that can be used from the given state
 * via DFS over all possible move sequences.
 * Also tracks max total pips used (for the "must use higher die" tiebreaker).
 */
function computeMaxDiceUsage(board, player, dice) {
  const moves = generateValidMoves(board, player, dice);
  if (moves.length === 0) return { maxCount: 0, maxPips: 0 };

  let maxCount = 0;
  let maxPips = 0;

  for (const move of moves) {
    const newBoard = applyMove(board, move, player);
    const newDice = getDiceAfterMove(dice, move.die);
    const sub = computeMaxDiceUsage(newBoard, player, newDice);
    const count = 1 + sub.maxCount;
    const pips = move.die + sub.maxPips;
    if (count > maxCount || (count === maxCount && pips > maxPips)) {
      maxCount = count;
      maxPips = pips;
    }
  }

  return { maxCount, maxPips };
}

/**
 * Filter valid moves to only those that lead to maximum dice usage.
 * Enforces:
 *   1) You must use as many dice as possible.
 *   2) If only one die can be used, you must use the higher one.
 *   3) If both dice can be used in different orders, all such first-moves are valid.
 */
function filterMovesForMaxDiceUsage(board, player, dice) {
  const moves = generateValidMoves(board, player, dice);
  if (moves.length === 0) return [];
  if (dice.length <= 1) return moves; // only one die left, no filtering needed

  const { maxCount, maxPips } = computeMaxDiceUsage(board, player, dice);

  // For each candidate first-move, check if it leads to the global maximum
  const filtered = [];
  for (const move of moves) {
    const newBoard = applyMove(board, move, player);
    const newDice = getDiceAfterMove(dice, move.die);
    const sub = computeMaxDiceUsage(newBoard, player, newDice);
    const totalCount = 1 + sub.maxCount;
    const totalPips = move.die + sub.maxPips;

    if (totalCount === maxCount && totalPips === maxPips) {
      filtered.push(move);
    }
  }

  // Fallback: if pip-exact match is too strict (e.g. multiple pip totals reach maxCount),
  // allow all moves that reach maxCount
  if (filtered.length === 0) {
    for (const move of moves) {
      const newBoard = applyMove(board, move, player);
      const newDice = getDiceAfterMove(dice, move.die);
      const sub = computeMaxDiceUsage(newBoard, player, newDice);
      if (1 + sub.maxCount === maxCount) {
        filtered.push(move);
      }
    }
  }

  // "Must use higher die" rule: if only 1 die can be used and dice differ,
  // keep only moves using the higher die
  if (maxCount === 1) {
    const uniqueDice = [...new Set(dice)];
    if (uniqueDice.length > 1) {
      const maxDie = Math.max(...uniqueDice);
      const higherMoves = filtered.filter(m => m.die === maxDie);
      if (higherMoves.length > 0) return higherMoves;
    }
  }

  return filtered;
}

function getDiceAfterMove(dice, usedDie) {
  const idx = dice.indexOf(usedDie);
  const remaining = [...dice];
  remaining.splice(idx, 1);
  return remaining;
}

function rollDice() {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

function expandDice(dice) {
  if (dice[0] === dice[1]) {
    return [dice[0], dice[0], dice[0], dice[0]];
  }
  return [...dice];
}

/**
 * Pip count: total distance to bear off (lower = closer to winning).
 *   White moving 1→24: pip at point i = 25 - i
 *   Black moving 24→1: pip at point i = i
 */
function getPipCount(board, player) {
  const isWhite = player === PLAYERS.WHITE;
  let count = 0;
  for (let i = 1; i <= 24; i++) {
    if (isWhite && board[i] > 0) {
      count += board[i] * (25 - i);
    } else if (!isWhite && board[i] < 0) {
      count += Math.abs(board[i]) * i;
    }
  }
  // Bar pieces (furthest possible = 25 pips each)
  if (isWhite && board[0] > 0) count += board[0] * 25;
  if (!isWhite && board[25] < 0) count += Math.abs(board[25]) * 25;
  return count;
}
