// Sound Manager using Web Audio API
// Generates all sounds procedurally — no external files needed.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._unlocked = false;
  }

  // Call this directly from a user-gesture handler (click / touchstart)
  // so the AudioContext gets created and resumed within the gesture chain.
  unlock() {
    if (this._unlocked) return;
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this._unlocked = true;
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
    if (!this.enabled) return;
    // Lazy-create context if unlock() was never called
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.enabled = false; return; }
    }
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

  // Dice roll: layered noise bursts
  _playDice() {
    const ctx = this.ctx;
    for (let k = 0; k < 3; k++) {
      const delay = k * 0.06;
      const dur = 0.22;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.75, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + delay);
    }
  }

  // Piece move: wooden thunk
  _playMove() {
    const ctx = this.ctx;
    const dur = 0.18;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Hit: sharper crack
  _playHit() {
    const ctx = this.ctx;
    const dur = 0.2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    src.connect(gain);
    osc.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  // Bear off: satisfying pop + chime
  _playBearOff() {
    const ctx = this.ctx;
    const freqs = [600, 800];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.02);
      osc.stop(ctx.currentTime + 0.28);
    });
  }

  // Game over: ascending chord
  _playGameOver() {
    const ctx = this.ctx;
    const notes = [261.6, 329.6, 392, 523.3];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.38, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.75);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

// Global instance
const sounds = new SoundManager();
