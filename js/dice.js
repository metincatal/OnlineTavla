// Dice rolling animation and display

class DiceManager {
  constructor() {
    this.rolling = false;
    this.animationInterval = null;
  }

  /**
   * Animate dice rolling then resolve with final values.
   * Returns a Promise resolving to the final dice array.
   */
  animateRoll(finalDice, durationMs = 600) {
    return new Promise((resolve) => {
      if (this.rolling) return;
      this.rolling = true;

      const container = document.getElementById('dice-animation-container');
      if (!container) {
        this.rolling = false;
        resolve(finalDice);
        return;
      }

      container.classList.add('rolling');
      const startTime = Date.now();
      let frames = 0;

      this.animationInterval = setInterval(() => {
        frames++;
        const fakeD1 = Math.floor(Math.random() * 6) + 1;
        const fakeD2 = Math.floor(Math.random() * 6) + 1;
        this.renderAnimDice(container, [fakeD1, fakeD2]);

        if (Date.now() - startTime >= durationMs) {
          clearInterval(this.animationInterval);
          this.animationInterval = null;
          this.renderAnimDice(container, finalDice);
          container.classList.remove('rolling');
          this.rolling = false;
          resolve(finalDice);
        }
      }, 60);
    });
  }

  renderAnimDice(container, dice) {
    container.innerHTML = '';
    dice.forEach(value => {
      const die = document.createElement('div');
      die.className = 'die';
      die.innerHTML = this.getDieFaceHTML(value);
      container.appendChild(die);
    });
  }

  getDieFaceHTML(value) {
    const dotSets = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    };
    const dots = dotSets[value] || [];
    return dots.map(pos => `<span class="dot ${pos}"></span>`).join('');
  }

  showDiceResult(dice, remainingDice, currentPlayer) {
    const container = document.getElementById('dice-animation-container');
    if (!container) return;

    container.innerHTML = '';
    // Settle the remaining dice counts correctly
    const remainCopy = [...remainingDice];
    dice.forEach((value, i) => {
      const die = document.createElement('div');

      const idx = remainCopy.indexOf(value);
      const stillRemaining = idx !== -1;
      if (stillRemaining) remainCopy.splice(idx, 1);

      // Random but stable wobble: small rotation + translation per die
      const angle = (((value * 13 + i * 7) % 14) - 7);
      const tx = (((value * 5 + i * 11) % 10) - 5) * 0.8;
      const ty = (((value * 7 + i * 3) % 8) - 4) * 0.8;

      die.className = `die ${currentPlayer} ${!stillRemaining ? 'used' : ''}`;
      die.style.transform = `rotate(${angle}deg) translate(${tx}px, ${ty}px)`;
      die.innerHTML = this.getDieFaceHTML(value);
      container.appendChild(die);
    });
  }
}

// Standalone function for initial roll comparison
function showInitialRollDice(whiteRoll, blackRoll) {
  const container = document.getElementById('initial-roll-display');
  if (!container) return;

  container.innerHTML = `
    <div class="initial-roll">
      <div>
        <span class="player-label white-label">Beyaz</span>
        <div class="die white">${getDieFaceHTMLStatic(whiteRoll)}</div>
        <span class="die-value">${whiteRoll}</span>
      </div>
      <span class="vs">VS</span>
      <div>
        <span class="player-label black-label">Siyah</span>
        <div class="die black">${getDieFaceHTMLStatic(blackRoll)}</div>
        <span class="die-value">${blackRoll}</span>
      </div>
    </div>
  `;
}

function getDieFaceHTMLStatic(value) {
  const dotSets = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
  };
  const dots = dotSets[value] || [];
  return dots.map(pos => `<span class="dot ${pos}"></span>`).join('');
}
