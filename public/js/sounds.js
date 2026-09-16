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

  _dest() { return this.comp || this.ctx.destination; }

  // Her ses için offset (başlangıç) ve duration (süre) — saniye cinsinden
  // Orijinal dosyaya dokunulmaz, sadece bu aralık çalınır.
  static get TRIM() {
    return {
      dice: { offset: 0.05,    duration: 0.5 },
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
    // If context is suspended (desktop idle/tab-switch), resume first then play.
    // ctx.resume() is async — do NOT play until it resolves to avoid the ~500ms delay.
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        try { this._doPlay(name); } catch (e) { /* non-fatal */ }
      });
      return;
    }
    try { this._doPlay(name); } catch (e) { /* non-fatal */ }
  }

  _doPlay(name) {
    switch (name) {
      case 'dice':     return this._playDice();
      case 'move':     return this._playMove();
      case 'hit':      return this._playHit();
      case 'bearoff':  return this._playBearOff();
      case 'gameover': return this._playGameOver();
    }
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

  // ═══════════════════════════════════════════════════════════
  //  MEME SES EFEKTLERİ
  //  ---------------------------------------------------------
  //  Hepsi Web Audio ile anlık üretilir: indirilecek dosya yok,
  //  telif sorunu yok, çevrimdışı da çalışır.
  //  memes.js'teki her GIF'in `sound` alanı buradaki bir isimle eşleşir.
  // ═══════════════════════════════════════════════════════════

  playSfx(name) {
    if (!this.enabled) return;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._buildCompressor();
        Object.keys(this._rawArrays).forEach(k => this._decode(k));
      } catch (e) { this.enabled = false; return; }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => { try { this._doSfx(name); } catch (e) {} });
      return;
    }
    try { this._doSfx(name); } catch (e) { /* non-fatal */ }
  }

  _doSfx(name) {
    switch (name) {
      case 'korna':   return this._sfxKorna();
      case 'davul':   return this._sfxDavul();
      case 'trombon': return this._sfxTrombon();
      case 'kahkaha': return this._sfxKahkaha();
      case 'zil':     return this._sfxZil();
      case 'boom':    return this._sfxBoom();
      case 'sting':   return this._sfxSting();
      case 'alkis':   return this._sfxAlkis();
      case 'parilti': return this._sfxParilti();
      case 'tiktak':  return this._sfxTiktak();
      default:        return this._sfxBoom();
    }
  }

  // ─── Yardımcılar ────────────────────────────────────────────

  // Gürültü buffer'ı (beyaz gürültü)
  _noiseBuffer(dur) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Hafif distortion — korna/zil gibi seslere "sertlik" verir
  _shaper(amount) {
    const ws = this.ctx.createWaveShaper();
    // Tek uzunluk: girdi 0 iken eğrinin tam ortasına denk gelir, böylece
    // çıkışa DC kayması eklenmez (çift uzunlukta ~-0.003'lük sabit ofset olur).
    const n = 1025, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  // ─── Korna (airhorn) — zafer ────────────────────────────────
  _sfxKorna() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    // Üç patlama: kısa, kısa, uzun
    [[0, 0.16], [0.22, 0.16], [0.45, 0.62]].forEach(([at, dur]) => {
      const t = t0 + at;
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.38, t + 0.02);
      bus.gain.setValueAtTime(0.38, t + dur - 0.05);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const shaper = this._shaper(6);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
      bus.connect(shaper); shaper.connect(bp); bp.connect(this._dest());

      // Yoğun harmonik yığın = korna karakteri
      [1, 1.5, 2.01, 2.99, 4.02].forEach((mult, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(310 * mult * 0.94, t);
        osc.frequency.exponentialRampToValueAtTime(310 * mult, t + 0.05);
        osc.detune.value = (i % 2 ? 9 : -9);
        g.gain.value = 0.42 / (i + 1);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.02);
      });
    });
  }

  // ─── Davul-zurna — halay / dans ─────────────────────────────
  _sfxDavul() {
    const ctx = this.ctx, t0 = ctx.currentTime;

    const kick = (t, gain) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(g); g.connect(this._dest());
      osc.start(t); osc.stop(t + 0.26);
    };

    const tek = (t) => {  // davulun ince çubuk vuruşu
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.09);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      src.connect(hp); hp.connect(g); g.connect(this._dest());
      src.start(t);
    };

    // 2/4 halay ritmi: DÜM - tek - DÜM tek-tek
    const beat = 0.23;
    [0, 2, 4, 6].forEach(i => kick(t0 + i * beat / 2, 0.66));
    [1, 3, 5, 6.5, 7].forEach(i => tek(t0 + i * beat / 2));

    // Zurna ezgisi — bandpass'lı sawtooth + vibrato
    const notes = [587, 659, 698, 659, 587, 523, 587];
    const zg = ctx.createGain();
    zg.gain.value = 0.125;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.2;
    const shaper = this._shaper(3);
    zg.connect(shaper); shaper.connect(bp); bp.connect(this._dest());

    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 6.5; vibG.gain.value = 9;
    vib.connect(vibG);
    vib.start(t0); vib.stop(t0 + notes.length * 0.16 + 0.3);

    notes.forEach((f, i) => {
      const t = t0 + 0.08 + i * 0.16;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      vibG.connect(osc.detune);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.02);
      g.gain.setValueAtTime(1, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g); g.connect(zg);
      osc.start(t); osc.stop(t + 0.18);
    });
  }

  // ─── Sad trombone (womp womp) — yıkıldım ────────────────────
  _sfxTrombon() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const steps = [
      { f: 233, at: 0.00, dur: 0.26 },
      { f: 220, at: 0.26, dur: 0.26 },
      { f: 207, at: 0.52, dur: 0.26 },
      { f: 185, at: 0.78, dur: 0.85 },
    ];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 3;
    const shaper = this._shaper(2);
    shaper.connect(lp); lp.connect(this._dest());

    steps.forEach((s, i) => {
      const t = t0 + s.at;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sawtooth';
      // Her nota bir öncekinden kayarak iner — trombon kulisi hissi
      osc.frequency.setValueAtTime(i === 0 ? s.f : steps[i - 1].f, t);
      osc.frequency.exponentialRampToValueAtTime(s.f, t + 0.1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.04);
      g.gain.setValueAtTime(0.28, t + s.dur - 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
      osc.connect(g); g.connect(shaper);
      osc.start(t); osc.stop(t + s.dur + 0.02);

      // Son nota titreyerek söner
      if (i === steps.length - 1) {
        const vib = ctx.createOscillator(), vg = ctx.createGain();
        vib.frequency.value = 5.5; vg.gain.value = 14;
        vib.connect(vg); vg.connect(osc.detune);
        vib.start(t + 0.15); vib.stop(t + s.dur);
      }
    });
  }

  // ─── Kahkaha — gülme ────────────────────────────────────────
  // "ha-ha-ha": formant filtreli darbeler, üç ayrı sesle kalabalık hissi
  _sfxKahkaha() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const voice = (base, offset, count) => {
      // /a/ sesinin formantları
      const bus = ctx.createGain();
      // Üç formant bandpass'ı sinyalin çoğunu kestiği için giriş yüksek tutulur
      bus.gain.value = 2.6;
      [700, 1220, 2600].forEach((fq, i) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 7;
        const g = ctx.createGain(); g.gain.value = 1 / (i + 1);
        bus.connect(bp); bp.connect(g); g.connect(this._dest());
      });
      for (let k = 0; k < count; k++) {
        const t = t0 + offset + k * 0.165;
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'sawtooth';
        // Kahkaha boyunca perde düşer
        osc.frequency.setValueAtTime(base * (1 - k * 0.045), t);
        osc.frequency.linearRampToValueAtTime(base * (1 - k * 0.045) * 0.9, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + 0.14);
      }
    };
    voice(132, 0.00, 6);
    voice(158, 0.06, 5);
    voice(112, 0.11, 5);
  }

  // ─── Zil / kaba korna — sinir ───────────────────────────────
  _sfxZil() {
    const ctx = this.ctx, t0 = ctx.currentTime, dur = 0.85;
    const shaper = this._shaper(18);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.015);
    g.gain.setValueAtTime(0.45, t0 + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    shaper.connect(lp); lp.connect(g); g.connect(this._dest());

    [108, 163].forEach(f => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(shaper);
      osc.start(t0); osc.stop(t0 + dur);
    });
  }

  // ─── Boom (vine boom) — dalga ───────────────────────────────
  _sfxBoom() {
    const ctx = this.ctx, t0 = ctx.currentTime, dur = 1.0;

    // Vuruş anındaki tok darbe
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.06);
    const lp0 = ctx.createBiquadFilter(); lp0.type = 'lowpass'; lp0.frequency.value = 700;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.42, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    src.connect(lp0); lp0.connect(gn); gn.connect(this._dest());
    src.start(t0);

    // Derine inen bas
    [[118, 1], [236, 0.28]].forEach(([f, amp]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.28, t0 + dur * 0.75);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.64 * amp, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this._dest());
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    });
  }

  // ─── Dramatik vuruş (dun dun dunnn) — şok ───────────────────
  _sfxSting() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const hits = [
      { at: 0.00, dur: 0.22, f: 98 },
      { at: 0.30, dur: 0.22, f: 98 },
      { at: 0.60, dur: 1.15, f: 78 },
    ];
    hits.forEach((h, i) => {
      const t = t0 + h.at;
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.68, t + 0.02);
      bus.gain.setValueAtTime(0.68, t + h.dur - 0.14);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + h.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      bus.connect(lp); lp.connect(this._dest());

      // Minör ikili gerilim aralığı
      [1, 1.19, 2].forEach((mult, k) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = h.f * mult;
        osc.detune.value = k * 6;
        g.gain.value = 0.5 / (k + 1);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + h.dur + 0.02);
      });

      // Son vuruşta zil çırpması
      if (i === hits.length - 1) {
        const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(1.1);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        src.connect(hp); hp.connect(g); g.connect(this._dest());
        src.start(t);
      }
    });
  }

  // ─── Alkış — saygı / GG ─────────────────────────────────────
  _sfxAlkis() {
    const ctx = this.ctx, t0 = ctx.currentTime, dur = 1.9;
    // Rastgele el çırpmalarını tek bir buffer'a yazmak, yüzlerce node
    // yaratmaktan çok daha ucuz.
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    const sr = ctx.sampleRate;
    const clapCount = 260;
    for (let c = 0; c < clapCount; c++) {
      const start = Math.floor(Math.random() * (d.length - sr * 0.05));
      const len = Math.floor(sr * (0.012 + Math.random() * 0.02));
      const amp = 0.25 + Math.random() * 0.75;
      for (let i = 0; i < len && start + i < d.length; i++) {
        d[start + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (sr * 0.004));
      }
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    const g = ctx.createGain();
    // Yükselip sönen kalabalık
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.9, t0 + 0.25);
    g.gain.setValueAtTime(0.9, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(this._dest());
    src.start(t0);
  }

  // ─── Parıltı — zar / şans ───────────────────────────────────
  _sfxParilti() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    [1046, 1318, 1568, 2093].forEach((f, i) => {
      const t = t0 + i * 0.07;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(g); g.connect(this._dest());
      osc.start(t); osc.stop(t + 0.4);
    });
    // Üstte ince bir ışıltı
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.5);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.19, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    src.connect(hp); hp.connect(g); g.connect(this._dest());
    src.start(t0);
  }

  // ─── Saat tik-takı — bekle / sıkıldım ───────────────────────
  _sfxTiktak() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const t = t0 + i * 0.42;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(0.03);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = i % 2 ? 2400 : 3200;  // tik / tak
      bp.Q.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(4.0, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      src.connect(bp); bp.connect(g); g.connect(this._dest());
      src.start(t);
    }
  }
}

var sounds = new SoundManager();
