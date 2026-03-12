// Sound Manager using Web Audio API
// Generates all sounds procedurally — no external files needed.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    try {
      switch (name) {
        case 'dice':     return this._playDice();
        case 'move':     return this._playMove();
        case 'hit':      return this._playHit();
        case 'bearoff':  return this._playBearOff();
        case 'gameover': return this._playGameOver();
      }
    } catch (e) { /* audio errors are non-fatal */ }
  }

  // Dice roll: short noise burst
  _playDice() {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Piece move: soft wooden click
  _playMove() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // Hit: sharper impact sound
  _playHit() {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    src.connect(gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  // Bear off: satisfying pop
  _playBearOff() {
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.06);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(); osc1.stop(ctx.currentTime + 0.2);
    osc2.start(); osc2.stop(ctx.currentTime + 0.2);
  }

  // Game over: ascending chord
  _playGameOver() {
    const ctx = this.ctx;
    const notes = [261.6, 329.6, 392, 523.3]; // C-E-G-C chord
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.65);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Global instance
const sounds = new SoundManager();
