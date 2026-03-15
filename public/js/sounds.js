// Sound Manager — Web Audio API
// Fetch constructor'da başlar (gesture gerekmez).
// AudioContext ilk kullanıcı etkileşiminde oluşturulur.
// Decode edilmiş buffer'lar gesture dışından da (setTimeout, AI) çalınabilir.

class SoundManager {
  constructor() {
    this.ctx     = null;
    this.comp    = null;
    this.enabled = true;
    this._buffers    = {};  // decoded AudioBuffer'lar
    this._rawArrays  = {};  // fetch'ten gelen ham ArrayBuffer'lar
    this._fetchSounds();    // gesture gerekmeden hemen başla
  }

  // ─── 1. Adım: Dosyaları hemen fetch et ───────────────────────
  _fetchSounds() {
    const load = async (key, url) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        this._rawArrays[key] = await res.arrayBuffer();
        // AudioContext zaten varsa hemen decode et
        if (this.ctx) this._decode(key);
      } catch (e) { /* 404 veya ağ hatası → procedural */ }
    };
    load('dice', 'sounds/zar.mp3');
    load('move',  'sounds/pulHareket2.mp3');
  }

  // ─── 2. Adım: Ham buffer'ı decode et ─────────────────────────
  async _decode(key) {
    const raw = this._rawArrays[key];
    if (!raw || !this.ctx) return;
    try {
      this._buffers[key] = await new Promise((resolve, reject) => {
        // raw.slice(0): detached buffer hatasını önler
        this.ctx.decodeAudioData(raw.slice(0), resolve, reject);
      });
    } catch (e) { console.warn('[sounds] decode hatası:', key, e); }
  }

  // ─── Kullanıcı etkileşiminde çağır ───────────────────────────
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._buildCompressor();
        // Fetch zaten bitmiş olabilir, hemen decode et
        Object.keys(this._rawArrays).forEach(k => this._decode(k));
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { console.warn('[sounds] AudioContext hatası:', e); }
  }

  _buildCompressor() {
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value      = 20;
    comp.ratio.value     = 8;
    comp.attack.value    = 0.003;
    comp.release.value   = 0.2;
    comp.connect(this.ctx.destination);
    this.comp = comp;
  }

  _dest()   { return this.comp || this.ctx.destination; }
  _resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // Her ses için offset (başlangıç) ve duration (süre) — saniye cinsinden
  // Orijinal dosyaya dokunulmaz, sadece bu aralık çalınır.
  static get TRIM() {
    return {
      dice: { offset: 0,     duration: 0.80 },
      move: { offset: 0.3, duration: null  },  // baştan 30ms kırp, geri kalanı çal
    };
  }

  // Decode edilmiş buffer'ı çal; yoksa false → procedural devreye girer
  _playBuffer(key, gainVal = 1.0) {
    if (!this._buffers[key] || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = this._buffers[key];
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(g);
    g.connect(this._dest());
    const trim = SoundManager.TRIM[key];
    if (trim) {
      if (trim.duration != null) {
        src.start(0, trim.offset, trim.duration);
      } else {
        src.start(0, trim.offset);  // offset var, duration sınırı yok
      }
    } else {
      src.start();
    }
    return true;
  }

  // ─── Ses çalma ───────────────────────────────────────────────
  play(name) {
    if (!this.enabled) return;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._buildCompressor();
        Object.keys(this._rawArrays).forEach(k => this._decode(k));
      } catch (e) { console.warn('[sounds] lazy AudioContext hatası:', e); this.enabled = false; return; }
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
    } catch (e) { /* non-fatal */ }
  }

  // ─── Ses metodları ───────────────────────────────────────────

  _playDice() {
    if (this._playBuffer('dice', 1.0)) return;
    const ctx = this.ctx;
    for (let k = 0; k < 3; k++) {
      const delay = k * 0.06, dur = 0.22;
      const buf  = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const src  = ctx.createBufferSource(); src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.75, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      src.connect(gain); gain.connect(this._dest());
      src.start(ctx.currentTime + delay);
    }
  }

  _playMove() {
    if (this._playBuffer('move', 0.9)) return;
    const ctx = this.ctx;
    const dur  = 0.18;
    const buf  = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
    }
    const src    = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type  = 'lowpass'; filter.frequency.value = 600;
    const gain   = ctx.createGain();
    gain.gain.setValueAtTime(0.65, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this._dest());
    src.start();
  }

  _playHit() {
    if (this._playBuffer('move', 1.1)) return;
    const ctx = this.ctx, dur = 0.2;
    const buf  = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(gain); osc.connect(gain); gain.connect(this._dest());
    src.start(); osc.start(); osc.stop(ctx.currentTime + dur);
  }

  _playBearOff() {
    if (this._playBuffer('move', 0.8)) return;
    const ctx = this.ctx;
    [600, 800].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain); gain.connect(this._dest());
      osc.start(ctx.currentTime + i * 0.02);
      osc.stop(ctx.currentTime + 0.28);
    });
  }

  _playGameOver() {
    const ctx = this.ctx;
    [261.6, 329.6, 392, 523.3].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.38, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.7);
      osc.connect(gain); gain.connect(this._dest());
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.75);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

var sounds = new SoundManager();
