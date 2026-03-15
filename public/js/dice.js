// ═══════════════════════════════════════════════════════════════
// dice.js  —  3-D Physics Dice Animation + Static Result Display
//
// Referans video analizi (21 kare, 100ms aralık):
//   f01-04: Zarlar yok, bekleme ikonu dönüyor
//   f05:    İki zar sol dıştan küçük boyutla beliriyor
//   f06-08: Hızlı tumbling ile sağa doğru parabolik kavis
//   f09:    Zarlar birbirinden ayrılıyor (biri üst, biri alt)
//   f10-11: İlk çarpma, dönme yavaşlıyor, değerler okunuyor
//   f12-14: Zarlar neredeyse durmuş, birbirinden uzak
//   f15-21: Tamamen sabit, değerler net
//
// Temel özellikler:
//   • Zarlar KÜÇÜK (~%3.5 board)
//   • İnce kenar şeritleri (subtle)
//   • İki zar birbirinden uzak düşüyor
//   • Gölge subtle ve dinamik
//   • ~1.2s toplam animasyon
// ═══════════════════════════════════════════════════════════════

// ── 3-D Math helpers ─────────────────────────────────────────
function _rotX(a) { const c=Math.cos(a),s=Math.sin(a); return [1,0,0, 0,c,-s, 0,s,c]; }
function _rotY(a) { const c=Math.cos(a),s=Math.sin(a); return [c,0,s, 0,1,0, -s,0,c]; }
function _rotZ(a) { const c=Math.cos(a),s=Math.sin(a); return [c,-s,0, s,c,0, 0,0,1]; }

function _mulMM(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i*3+j] = a[i*3]*b[j] + a[i*3+1]*b[j+3] + a[i*3+2]*b[j+6];
  return r;
}

function _mulMV(m, v) {
  return [
    m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
    m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
    m[6]*v[0]+m[7]*v[1]+m[8]*v[2],
  ];
}

// ── Cube geometry ─────────────────────────────────────────────
const _VERTS = [
  [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],   // back face  (z=−1)
  [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],   // front face (z=+1)
];

// Standard Western die: 1↔6, 2↔5, 3↔4
const _FACES = [
  { vi:[4,5,6,7], val:1, n:[ 0, 0, 1] }, // front  +Z
  { vi:[1,0,3,2], val:6, n:[ 0, 0,-1] }, // back   −Z
  { vi:[5,1,2,6], val:2, n:[ 1, 0, 0] }, // right  +X
  { vi:[0,4,7,3], val:5, n:[-1, 0, 0] }, // left   −X
  { vi:[3,2,6,7], val:3, n:[ 0, 1, 0] }, // top    +Y
  { vi:[0,1,5,4], val:4, n:[ 0,-1, 0] }, // bottom −Y
];

// Dot UV (u=left→right, v=bottom→top)
const _DOT_UV = {
  1: [[.5,.5]],
  2: [[.28,.72],[.72,.28]],
  3: [[.28,.72],[.5,.5],[.72,.28]],
  4: [[.28,.72],[.72,.72],[.28,.28],[.72,.28]],
  5: [[.28,.72],[.72,.72],[.5,.5],[.28,.28],[.72,.28]],
  6: [[.28,.72],[.72,.72],[.28,.5],[.72,.5],[.28,.28],[.72,.28]],
};

// ── Color themes ──────────────────────────────────────────────
const _THEMES = {
  white: {
    face:    ['#FAF5EC','#EDE6D4','#DDD4C0'],
    dot:     '#2C1A0E',
    edgeOut: '#B82010',   // outer edge: dark red
    edgeMid: '#F0EAE0',   // mid edge: cream
    edgeIn:  '#1A1008',   // inner edge: near-black
  },
  black: {
    face:    ['#3A2A18','#261810','#120C06'],
    dot:     '#D4C4A4',
    edgeOut: '#B82010',
    edgeMid: '#C8BCA8',
    edgeIn:  '#080604',
  },
};

// ── Shadow (subtle, per video reference) ──────────────────────
function _drawShadow(ctx, gx, gy, gz, size) {
  const maxH  = size * 10;
  const t     = Math.min(gz / maxH, 1);
  const blur  = 1 + t * size * 0.8;
  const rx    = size * (0.45 + t * 0.3);
  const ry    = size * (0.2  + t * 0.12);
  const alpha = 0.35 - t * 0.28;          // subtle: max 0.35 opacity
  const offY  = gz * 0.1;

  ctx.save();
  ctx.filter      = `blur(${blur.toFixed(1)}px)`;
  ctx.globalAlpha = Math.max(alpha, 0);
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(gx, gy + offY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Die renderer ──────────────────────────────────────────────
function _drawDie(ctx, die, size, playerClass) {
  const theme = _THEMES[playerClass] || _THEMES.white;
  const M = _mulMM(_rotZ(die.angZ), _mulMM(_rotY(die.angY), _rotX(die.angX)));

  const sx = die.x;
  const sy = die.y - die.z * 0.7;

  // Perspective projection
  const PERSP = 5.5;
  const proj = _VERTS.map(v => {
    const r  = _mulMV(M, v);
    const pf = PERSP / (PERSP - r[2]);
    return {
      sx: sx + r[0] * pf * size,
      sy: sy - r[1] * pf * size,
      z3: r[2],
    };
  });

  // Visible faces
  const visible = [];
  for (const face of _FACES) {
    const rn = _mulMV(M, face.n);
    if (rn[2] + rn[1] * 0.12 > 0.01) {
      const depth = face.vi.reduce((s, i) => s + _mulMV(M, _VERTS[i])[2], 0) / 4;
      visible.push({ face, rn, depth });
    }
  }
  visible.sort((a, b) => a.depth - b.depth);

  // Light: top-right-front
  const LX = 0.35, LY = 0.55, LZ = 0.75;

  for (const { face, rn } of visible) {
    const pts = face.vi.map(i => proj[i]);
    const diff  = Math.max(0, rn[0]*LX + rn[1]*LY + rn[2]*LZ);
    const light = 0.32 + 0.68 * diff;
    const shade = rn[1] > 0.4 ? 0 : (rn[2] > 0.2 ? 1 : 2);

    ctx.save();

    // Clip to face
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    ctx.clip();

    // Face fill
    ctx.fillStyle   = theme.face[shade];
    ctx.globalAlpha = Math.min(light + 0.1, 1.0);
    ctx.fill();

    // Edge stripes — THIN per video reference
    // Three concentric strokes, clipped so only inner edge visible
    const ew = size * 0.06;  // much thinner than before
    ctx.lineJoin = 'round';

    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].sx, pts[0].sy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
      ctx.closePath();
    };

    // Outer: red
    path();
    ctx.strokeStyle = theme.edgeOut;
    ctx.lineWidth   = ew * 2.6;
    ctx.globalAlpha = 0.75;
    ctx.stroke();

    // Mid: cream/white
    path();
    ctx.strokeStyle = theme.edgeMid;
    ctx.lineWidth   = ew * 1.5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();

    // Inner: dark
    path();
    ctx.strokeStyle = theme.edgeIn;
    ctx.lineWidth   = ew * 0.5;
    ctx.globalAlpha = 0.6;
    ctx.stroke();

    ctx.restore();

    // Dots
    _drawDots(ctx, pts, face.val, theme.dot, size);
  }
}

function _drawDots(ctx, pts, value, dotColor, size) {
  const uvs = _DOT_UV[value];
  if (!uvs) return;

  const dotR = size * 0.12;
  ctx.save();
  ctx.fillStyle   = dotColor;
  ctx.globalAlpha = 1.0;

  for (const [u, v] of uvs) {
    const bx = pts[0].sx + (pts[1].sx - pts[0].sx) * u;
    const by = pts[0].sy + (pts[1].sy - pts[0].sy) * u;
    const tx = pts[3].sx + (pts[2].sx - pts[3].sx) * u;
    const ty = pts[3].sy + (pts[2].sy - pts[3].sy) * u;
    const px = bx + (tx - bx) * v;
    const py = by + (ty - by) * v;

    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// DiceManager
// ═══════════════════════════════════════════════════════════════

class DiceManager {
  constructor() {
    this.rolling    = false;
    this._animFrame = null;
  }

  /**
   * 3D physics dice roll animation.
   * Video-matched timing:
   *   0-400ms   dice not visible (optional wait phase)
   *   400-600ms spawn from left, fast tumble
   *   600-900ms fly toward center-left with parabolic arc
   *   900-1100ms first bounce, slowing
   *   1100-1400ms settle
   *   1400ms+   static
   */
  animateRoll(finalDice, durationMs = 600, playerClass = 'white') {
    return new Promise((resolve) => {
      if (this.rolling) { resolve(finalDice); return; }
      this.rolling = true;

      const htmlContainer = document.getElementById('dice-animation-container');
      if (htmlContainer) htmlContainer.innerHTML = '';

      const boardContainer = document.querySelector('.board-container');
      if (!boardContainer || !boardContainer.getBoundingClientRect().width) {
        this.rolling = false;
        resolve(finalDice);
        return;
      }

      // Canvas overlay on board
      const canvas  = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15;';
      boardContainer.appendChild(canvas);

      const rect = boardContainer.getBoundingClientRect();
      canvas.width  = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;

      // ── Die size: SMALL per video (~3.5% of board width) ────
      const DIE_SIZE = W * 0.035;

      // ── Physics ────────────────────────────────────────────
      const GRAVITY     = 0.00088;
      const BOUNCE_REST = [0.46, 0.26, 0.10];
      const FRIC_XY     = 0.965;
      const ANG_FRIC    = 0.72;

      // ── Positions ─────────────────────────────────────────
      // Spawn: off-screen left.  Land: left quarter, spread vertically.
      const spawnX = -DIE_SIZE * 1.5;       // off-screen left
      const spawnY = H * 0.5;

      // Two target positions: spread apart vertically
      // Video shows one die landing upper-left, other lower-left
      const targets = [
        { x: W * 0.17, y: H * 0.34 },  // die 0: upper-left area
        { x: W * 0.20, y: H * 0.64 },  // die 1: lower-left area
      ];

      // ── Delay: dice appear after ~200ms (video: ~400ms but we're faster) ──
      const SPAWN_DELAY = 180;   // ms before dice become visible

      // ── Initialise dice ───────────────────────────────────
      const diceState = [0, 1].map(i => {
        const tgt = targets[i];
        const dx  = tgt.x - spawnX;
        const dy  = tgt.y - spawnY;
        // Time to first bounce: ~380-450ms after spawn
        const tAir = 380 + i * 40 + Math.random() * 50;
        return {
          value:  finalDice[i] !== undefined ? finalDice[i] : 1,
          x: spawnX, y: spawnY, z: 0,
          vx: dx / tAir,
          vy: dy / tAir,
          vz: GRAVITY * tAir * 0.52,
          angX: Math.random() * Math.PI * 2,
          angY: Math.random() * Math.PI * 2,
          angZ: Math.random() * Math.PI * 2,
          omegaX: (0.014 + Math.random() * 0.010) * (Math.random() < .5 ? 1 : -1),
          omegaY: (0.016 + Math.random() * 0.008) * (Math.random() < .5 ? 1 : -1),
          omegaZ: (0.009 + Math.random() * 0.006) * (Math.random() < .5 ? 1 : -1),
          bounces:    0,
          maxBounces: 2 + Math.floor(Math.random() * 2),
          settled:    false,
          settleTime: null,
          restAngZ:   (Math.random() - 0.5) * 0.5,
          spawned:    false,
        };
      });

      const startTime = performance.now();
      let lastTime    = startTime;
      let resolveAt   = null;

      const _finish = () => {
        if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
        canvas.style.transition = 'opacity 0.15s ease';
        canvas.style.opacity    = '0';
        setTimeout(() => {
          canvas.remove();
          this.rolling = false;
          resolve(finalDice);
        }, 160);
      };

      const frame = (now) => {
        const dt      = Math.min(now - lastTime, 33);
        lastTime      = now;
        const elapsed = now - startTime;

        ctx.clearRect(0, 0, W, H);

        let settledCount = 0;

        for (const d of diceState) {
          // Spawn delay
          if (!d.spawned) {
            if (elapsed < SPAWN_DELAY) continue;
            d.spawned = true;
          }

          // ── Shadow ──
          _drawShadow(ctx, d.x, d.y, d.z, DIE_SIZE);

          // ── Physics ──
          if (!d.settled) {
            d.vz -= GRAVITY * dt;
            d.x  += d.vx * dt;
            d.y  += d.vy * dt;
            d.z  += d.vz * dt;
            d.angX += d.omegaX * dt;
            d.angY += d.omegaY * dt;
            d.angZ += d.omegaZ * dt;

            if (d.z <= 0) {
              d.z = 0;
              const ri    = Math.min(d.bounces, BOUNCE_REST.length - 1);
              const newVz = Math.abs(d.vz) * BOUNCE_REST[ri];
              d.vx     *= FRIC_XY;
              d.vy     *= FRIC_XY;
              d.omegaX *= ANG_FRIC;
              d.omegaY *= ANG_FRIC;
              d.omegaZ *= ANG_FRIC;
              d.bounces++;

              if (newVz < 0.032 || d.bounces > d.maxBounces) {
                d.settled    = true;
                d.settleTime = now;
                d.vx = d.vy = d.vz = 0;
              } else {
                d.vz = newVz;
              }
            }
          } else {
            settledCount++;
            // Damp rotation post-settle
            const decay = 0.88;
            d.omegaX *= decay;
            d.omegaY *= decay;
            d.omegaZ *= decay;
            d.angX += d.omegaX * dt;
            d.angY += d.omegaY * dt;
            d.angZ += d.omegaZ * dt;
            // Ease angZ toward rest
            const ts = now - d.settleTime;
            if (ts > 100) {
              d.angZ += (d.restAngZ - d.angZ) * 0.06;
            }
          }

          _drawDie(ctx, d, DIE_SIZE, playerClass);
        }

        // Resolve after all settled + brief pause
        if (settledCount === diceState.length && resolveAt === null) {
          resolveAt = now + 250;
        }
        if ((resolveAt !== null && now >= resolveAt) || elapsed > 2800) {
          _finish();
          return;
        }

        this._animFrame = requestAnimationFrame(frame);
      };

      this._animFrame = requestAnimationFrame(frame);
    });
  }

  // ── Static dice display after roll ────────────────────────
  showDiceResult(dice, remainingDice, currentPlayer) {
    const container = document.getElementById('dice-animation-container');
    if (!container) return;

    container.innerHTML = '';
    const remainCopy = [...remainingDice];

    dice.forEach((value, i) => {
      const die = document.createElement('div');

      const idx = remainCopy.indexOf(value);
      const stillRemaining = idx !== -1;
      if (stillRemaining) remainCopy.splice(idx, 1);

      const angle = (((value * 13 + i * 7) % 14) - 7);
      const tx    = (((value * 5  + i * 11) % 10) - 5) * 0.8;
      const ty    = (((value * 7  + i * 3)  % 8)  - 4) * 0.8;

      die.className = `die ${currentPlayer} ${!stillRemaining ? 'used' : ''}`;
      die.style.transform = `rotate(${angle}deg) translate(${tx}px, ${ty}px)`;
      die.innerHTML = this.getDieFaceHTML(value);
      container.appendChild(die);
    });
  }

  getDieFaceHTML(value) {
    const dotSets = {
      1: ['center'],
      2: ['top-left','bottom-right'],
      3: ['top-left','center','bottom-right'],
      4: ['top-left','top-right','bottom-left','bottom-right'],
      5: ['top-left','top-right','center','bottom-left','bottom-right'],
      6: ['top-left','top-right','middle-left','middle-right','bottom-left','bottom-right'],
    };
    return (dotSets[value] || []).map(p => `<span class="dot ${p}"></span>`).join('');
  }
}

// ── Initial roll display ──────────────────────────────────────
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
    </div>`;
}

function getDieFaceHTMLStatic(value) {
  const dotSets = {
    1: ['center'],
    2: ['top-left','bottom-right'],
    3: ['top-left','center','bottom-right'],
    4: ['top-left','top-right','bottom-left','bottom-right'],
    5: ['top-left','top-right','center','bottom-left','bottom-right'],
    6: ['top-left','top-right','middle-left','middle-right','bottom-left','bottom-right'],
  };
  return (dotSets[value] || []).map(p => `<span class="dot ${p}"></span>`).join('');
}
