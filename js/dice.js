// ═══════════════════════════════════════════════════════════════
// dice.js  —  3-D Physics Dice Animation + Persistent Canvas Display
//
// v3 Düzeltmeler:
//   1. Zarlar birbirinin üzerine binmiyor (yeterli aralık)
//   2. Canlı renkler (parlak beyaz yüz, koyu siyah nokta)
//   3. Kullanılmamış zarların etrafında yeşil ışıldayan çerçeve
//      (çift zarda çift çerçeve), kullanılan zarın ışıltısı söner
//   4. Barın sol kenarından sekme (bara girmez)
//   5. Opak render, kalıcı canvas
// ═══════════════════════════════════════════════════════════════

// ── 3-D Math ─────────────────────────────────────────────────
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
  [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
  [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
];

const _FACES = [
  { vi:[4,5,6,7], val:1, n:[ 0, 0, 1] },
  { vi:[1,0,3,2], val:6, n:[ 0, 0,-1] },
  { vi:[5,1,2,6], val:2, n:[ 1, 0, 0] },
  { vi:[0,4,7,3], val:5, n:[-1, 0, 0] },
  { vi:[3,2,6,7], val:3, n:[ 0, 1, 0] },
  { vi:[0,1,5,4], val:4, n:[ 0,-1, 0] },
];

const _DOT_UV = {
  1: [[.5,.5]],
  2: [[.28,.72],[.72,.28]],
  3: [[.28,.72],[.5,.5],[.72,.28]],
  4: [[.28,.72],[.72,.72],[.28,.28],[.72,.28]],
  5: [[.28,.72],[.72,.72],[.5,.5],[.28,.28],[.72,.28]],
  6: [[.28,.72],[.72,.72],[.28,.5],[.72,.5],[.28,.28],[.72,.28]],
};

// ── Target rotations: which angX/angY makes face value V face the camera (+Z) ──
const _FACE_TARGET = {
  1: { x: 0,            y: 0 },
  2: { x: 0,            y: -Math.PI/2 },
  3: { x: Math.PI/2,    y: 0 },
  4: { x: -Math.PI/2,   y: 0 },
  5: { x: 0,            y: Math.PI/2 },
  6: { x: Math.PI,      y: 0 },
};

// Snap angle to nearest equivalent of target (avoids long rotations)
function _snapAngle(current, target) {
  const TWO_PI = Math.PI * 2;
  const n = Math.round((current - target) / TWO_PI);
  return target + n * TWO_PI;
}

// ── Vivid white dice theme ──────────────────────────────────
const _THEME = {
  face:    ['#FFFFFF','#F8F4EE','#EDE8DE'],   // parlak beyaz
  dot:     '#080808',                          // koyu siyah nokta
  edgeOut: '#C0200C',
  edgeMid: '#F5EFE4',
  edgeIn:  '#1A0E06',
};

// ── Shadow ────────────────────────────────────────────────────
function _drawShadow(ctx, gx, gy, gz, baseSize) {
  const maxH  = baseSize * 12;
  const t     = Math.min(gz / maxH, 1);
  const blur  = 1.5 + t * baseSize * 0.6;
  const rx    = baseSize * (0.50 + t * 0.30);
  const ry    = baseSize * (0.24 + t * 0.12);
  const alpha = 0.30 - t * 0.22;
  const offY  = gz * 0.08;

  ctx.save();
  ctx.filter      = `blur(${blur.toFixed(1)}px)`;
  ctx.globalAlpha = Math.max(alpha, 0);
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(gx, gy + offY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Die renderer — fully opaque ────────────────────────────────
function _drawDie(ctx, die, visualSize) {
  const M = _mulMM(_rotZ(die.angZ), _mulMM(_rotY(die.angY), _rotX(die.angX)));

  const sx = die.x;
  const sy = die.y - die.z * 0.7;

  const PERSP = 5.5;
  const proj = _VERTS.map(v => {
    const r  = _mulMV(M, v);
    const pf = PERSP / (PERSP - r[2]);
    return {
      sx: sx + r[0] * pf * visualSize,
      sy: sy - r[1] * pf * visualSize,
    };
  });

  const visible = [];
  for (const face of _FACES) {
    const rn = _mulMV(M, face.n);
    if (rn[2] + rn[1] * 0.12 > 0.01) {
      const depth = face.vi.reduce((s, i) => s + _mulMV(M, _VERTS[i])[2], 0) / 4;
      visible.push({ face, rn, depth });
    }
  }
  visible.sort((a, b) => a.depth - b.depth);

  const LX = 0.35, LY = 0.55, LZ = 0.75;

  for (const { face, rn } of visible) {
    const pts = face.vi.map(i => proj[i]);
    const diff  = Math.max(0, rn[0]*LX + rn[1]*LY + rn[2]*LZ);
    const light = 0.38 + 0.62 * diff;
    const shade = rn[1] > 0.4 ? 0 : (rn[2] > 0.2 ? 1 : 2);

    ctx.save();

    // Clip to face
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    ctx.clip();

    // Face fill — apply lighting via color, NOT via alpha
    const base = _THEME.face[shade];
    const cr = parseInt(base.slice(1,3), 16);
    const cg = parseInt(base.slice(3,5), 16);
    const cb = parseInt(base.slice(5,7), 16);
    ctx.fillStyle   = `rgb(${Math.round(cr*light)},${Math.round(cg*light)},${Math.round(cb*light)})`;
    ctx.globalAlpha = 1.0;
    ctx.fill();

    // Edge stripes
    const ew = visualSize * 0.055;
    const _path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].sx, pts[0].sy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';

    _path(); ctx.strokeStyle = _THEME.edgeOut; ctx.lineWidth = ew*2.8; ctx.globalAlpha = 0.72; ctx.stroke();
    _path(); ctx.strokeStyle = _THEME.edgeMid; ctx.lineWidth = ew*1.6; ctx.globalAlpha = 0.65; ctx.stroke();
    _path(); ctx.strokeStyle = _THEME.edgeIn;  ctx.lineWidth = ew*0.5; ctx.globalAlpha = 0.52; ctx.stroke();

    ctx.restore();

    // Dots — deep black
    const uvs = _DOT_UV[face.val];
    if (uvs) {
      const dotR = visualSize * 0.12;
      ctx.save();
      ctx.fillStyle   = _THEME.dot;
      ctx.globalAlpha = 1.0;
      for (const [u, v] of uvs) {
        const bx = pts[0].sx + (pts[1].sx - pts[0].sx) * u;
        const by = pts[0].sy + (pts[1].sy - pts[0].sy) * u;
        const tx = pts[3].sx + (pts[2].sx - pts[3].sx) * u;
        const ty = pts[3].sy + (pts[2].sy - pts[3].sy) * u;
        ctx.beginPath();
        ctx.arc(bx + (tx - bx) * v, by + (ty - by) * v, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ── Project cube vertices at a given scale ───────────────────
function _projectDie(die, visualSize, scale) {
  const M = _mulMM(_rotZ(die.angZ), _mulMM(_rotY(die.angY), _rotX(die.angX)));
  const sx = die.x;
  const sy = die.y - die.z * 0.7;
  const PERSP = 5.5;
  const s = visualSize * scale;

  return _VERTS.map(v => {
    const r  = _mulMV(M, v);
    const pf = PERSP / (PERSP - r[2]);
    return { sx: sx + r[0] * pf * s, sy: sy - r[1] * pf * s };
  });
}

// ── Convex hull (Andrew's monotone chain, perfect for 8 points) ──
function _convexHull(points) {
  const pts = [...points].sort((a, b) => a.sx - b.sx || a.sy - b.sy);
  if (pts.length <= 2) return pts;

  const cross = (O, A, B) =>
    (A.sx - O.sx) * (B.sy - O.sy) - (A.sy - O.sy) * (B.sx - O.sx);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], pts[i]) <= 0)
      upper.pop();
    upper.push(pts[i]);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ── Green glow frame — follows die's 3D rotation perfectly ───
function _drawGlowFrame(ctx, die, halfDie, frameCount) {
  if (frameCount <= 0) return;

  ctx.save();
  ctx.shadowColor = '#00E840';
  ctx.lineJoin    = 'round';

  // Inner frame: project cube at 1.06× scale → convex hull
  const inner = _convexHull(_projectDie(die, halfDie, 1.06));
  ctx.shadowBlur  = 12;
  ctx.strokeStyle = 'rgba(0, 220, 60, 0.88)';
  ctx.lineWidth   = 2.5;
  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.moveTo(inner[0].sx, inner[0].sy);
  for (let i = 1; i < inner.length; i++) ctx.lineTo(inner[i].sx, inner[i].sy);
  ctx.closePath();
  ctx.stroke();

  // Outer frame (doubles — second logical die)
  if (frameCount >= 2) {
    const outer = _convexHull(_projectDie(die, halfDie, 1.18));
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = 'rgba(0, 220, 60, 0.65)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(outer[0].sx, outer[0].sy);
    for (let i = 1; i < outer.length; i++) ctx.lineTo(outer[i].sx, outer[i].sy);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

// ── Compute bar left edge in canvas pixels ────────────────────
function _getBarLeftX(boardContainer) {
  const svgEl = document.getElementById('board-svg');
  if (!svgEl) return null;

  const svgRect   = svgEl.getBoundingClientRect();
  const boardRect = boardContainer.getBoundingClientRect();

  // SVG viewBox: 0 0 1200 750, preserveAspectRatio xMidYMid meet
  const svgVBWidth = 1200;
  const scale      = svgRect.width / svgVBWidth;
  const offsetX    = svgRect.left - boardRect.left;

  // Bar left edge in SVG coords: BOARD_MARGIN + INNER_PAD + BEAR_OFF_WIDTH + 4 + 6*POINT_WIDTH
  const barLeftSVG = BOARD_MARGIN + INNER_PAD + BEAR_OFF_WIDTH + 4 + 6 * POINT_WIDTH;
  return offsetX + barLeftSVG * scale;
}

// ═══════════════════════════════════════════════════════════════
// DiceManager
// ═══════════════════════════════════════════════════════════════

class DiceManager {
  constructor() {
    this.rolling       = false;
    this._animFrame    = null;
    this._canvas       = null;
    this._ctx          = null;
    this._finalDice    = null;   // [{value, x, y, z, angX, angY, angZ}, ...]
    this._allDice      = [];
    this._remainingDice = [];
    this._W            = 0;
    this._H            = 0;
    this._dpr          = 1;

    // Recalculate canvas on visibility change (phone sleep/wake) and resize
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(() => this._recalcCanvas(), 100);
    });
    window.addEventListener('resize', () => this._recalcCanvas());
  }

  // ── Remove persistent canvas ──────────────────────────────
  _removeCanvas() {
    this._stopGlow();
    if (this._canvas) { this._canvas.remove(); this._canvas = null; this._ctx = null; }
    this._finalDice = null;
  }

  _stopGlow() {
    // no-op — kept for compatibility
  }

  // ── Recalculate canvas dims + dice positions after resize/wake ──
  _recalcCanvas() {
    if (!this._canvas || !this._finalDice || this.rolling) return;
    const boardContainer = this._canvas.parentElement;
    if (!boardContainer) return;

    const boardRect = boardContainer.getBoundingClientRect();
    if (!boardRect.width || !boardRect.height) return;

    const dpr = window.devicePixelRatio || 1;
    this._canvas.width  = boardRect.width * dpr;
    this._canvas.height = boardRect.height * dpr;
    this._ctx = this._canvas.getContext('2d');
    this._dpr = dpr;
    this._W = boardRect.width;
    this._H = boardRect.height;

    // Recalculate dice target positions for new size
    const htmlDieSize = window.innerHeight <= 420 ? 30 : 44;
    const separation  = htmlDieSize * 1.4;
    const barLeftX    = _getBarLeftX(boardContainer) || this._W * 0.433;
    const boardLeftEdge = this._W * 0.04;
    const leftHalfCX  = (boardLeftEdge + barLeftX) / 2;
    const targetCY    = this._H * 0.50;

    if (this._finalDice.length >= 2) {
      this._finalDice[0].x = leftHalfCX - separation / 2;
      this._finalDice[0].y = targetCY - 2;
      this._finalDice[1].x = leftHalfCX + separation / 2;
      this._finalDice[1].y = targetCY + 2;
    }

    this._redrawStatic();
  }

  // ── Compute frame count per physical die ──────────────────
  _getFrameCounts() {
    if (!this._finalDice || this._finalDice.length < 2) return [0, 0];

    const v0 = this._finalDice[0].value;
    const v1 = this._finalDice[1].value;
    const isDouble = (v0 === v1);

    if (isDouble) {
      // Doubles: 4 logical dice, 2 physical. Distribute remaining evenly.
      const remCount = this._remainingDice.filter(v => v === v0).length;
      return [Math.ceil(remCount / 2), Math.floor(remCount / 2)];
    } else {
      // Non-doubles: each die has 0 or 1 frame
      const has0 = this._remainingDice.includes(v0) ? 1 : 0;
      const remainAfter0 = [...this._remainingDice];
      if (has0) remainAfter0.splice(remainAfter0.indexOf(v0), 1);
      const has1 = remainAfter0.includes(v1) ? 1 : 0;
      return [has0, has1];
    }
  }

  // ── Redraw static dice on persistent canvas ────────────────
  _redrawStatic() {
    if (!this._canvas || !this._finalDice || !this._ctx) return;
    const ctx = this._ctx;
    const dpr = this._dpr || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this._W, this._H);

    const halfDie = (window.innerHeight <= 420 ? 30 : 44) / 2;
    const frameCounts = this._getFrameCounts();

    for (let i = 0; i < this._finalDice.length; i++) {
      const d = this._finalDice[i];
      _drawShadow(ctx, d.x, d.y, 0, halfDie);
      _drawDie(ctx, d, halfDie);
      // Green glow frame — solid, no pulsing
      _drawGlowFrame(ctx, d, halfDie, frameCounts[i]);
    }
    ctx.restore();
  }

  // ── 3D physics dice animation ──────────────────────────────
  animateRoll(finalDice, durationMs = 600, playerClass = 'white') {
    return new Promise((resolve) => {
      if (this.rolling) { resolve(finalDice); return; }
      this.rolling = true;

      // Clear HTML dice & old canvas
      const htmlContainer = document.getElementById('dice-animation-container');
      if (htmlContainer) htmlContainer.innerHTML = '';
      this._removeCanvas();

      const boardContainer = document.querySelector('.board-container');
      if (!boardContainer || !boardContainer.getBoundingClientRect().width) {
        this.rolling = false;
        resolve(finalDice);
        return;
      }

      // ── Canvas overlay (HiDPI aware) ──
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15;';
      boardContainer.appendChild(canvas);
      this._canvas = canvas;

      const boardRect = boardContainer.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = boardRect.width * dpr;
      canvas.height = boardRect.height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      this._ctx = ctx;
      this._dpr = dpr;
      const W = this._W = boardRect.width;
      const H = this._H = boardRect.height;

      const htmlDieSize = window.innerHeight <= 420 ? 30 : 44;
      const halfDie     = htmlDieSize / 2;

      // ── Bar collision boundary ──
      const barLeftX = _getBarLeftX(boardContainer) || W * 0.433;

      // ── Target positions: left half, well separated ──
      // Center of left half: midpoint between board left edge and bar
      const boardLeftEdge = W * 0.04;
      const leftHalfCX = (boardLeftEdge + barLeftX) / 2;
      const targetCY = H * 0.50;

      // Horizontal separation: enough so dice never overlap
      const separation = htmlDieSize * 1.4;
      const targets = [
        { x: leftHalfCX - separation / 2, y: targetCY - 2 },
        { x: leftHalfCX + separation / 2, y: targetCY + 2 },
      ];

      // ── Physics constants ──
      const GRAVITY     = 0.00092;
      const BOUNCE_REST = [0.35, 0.12, 0.03];
      const FRIC_XY     = 0.86;
      const ANG_FRIC    = 0.50;
      const H_SCALE     = 0.007;

      // ── Spawn: off-screen left, already in air ──
      const spawnX = -halfDie * 3;
      const spawnZ = halfDie * 4 + Math.random() * halfDie;
      const flightTime = 480 + Math.random() * 60;

      let soundPlayed = false;

      const diceState = [0, 1].map(i => {
        const tgt = targets[i];
        const spawnY = targetCY + (i === 0 ? -10 : 10);

        const dx = tgt.x - spawnX;
        const dy = tgt.y - spawnY;

        return {
          value:  finalDice[i] !== undefined ? finalDice[i] : 1,
          x: spawnX,
          y: spawnY,
          z: spawnZ + i * 5,
          vx: (dx / flightTime) * 1.05,
          vy: (dy / flightTime) * 0.85,
          vz: 0.035 + Math.random() * 0.012,
          angX: Math.random() * Math.PI * 2,
          angY: Math.random() * Math.PI * 2,
          angZ: Math.random() * Math.PI * 2,
          omegaX: (0.005 + Math.random() * 0.004) * (Math.random() < .5 ? 1 : -1),
          omegaY: (0.004 + Math.random() * 0.003) * (Math.random() < .5 ? 1 : -1),
          omegaZ: (0.002 + Math.random() * 0.002) * (Math.random() < .5 ? 1 : -1),
          bounces:    0,
          maxBounces: 2 + Math.floor(Math.random() * 2),
          settled:    false,
          settleTime: null,
          targetX:    tgt.x,
          targetY:    tgt.y,
          finalAngX:  0,
          finalAngY:  0,
          finalAngZ:  0,
        };
      });

      this._allDice = [...finalDice];
      this._remainingDice = [...finalDice];

      const startTime = performance.now();
      let lastTime    = startTime;
      let resolveAt   = null;

      const _finish = () => {
        if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }

        this._finalDice = diceState.map(d => ({
          value: d.value,
          x:     d.targetX,
          y:     d.targetY,
          z:     0,
          angX:  d.finalAngX,
          angY:  d.finalAngY,
          angZ:  d.finalAngZ,
        }));

        // Draw final static frame with glow
        this._redrawStatic();
        this.rolling = false;
        resolve(finalDice);
      };

      const frame = (now) => {
        const dt      = Math.min(now - lastTime, 33);
        lastTime      = now;
        const elapsed = now - startTime;

        ctx.clearRect(0, 0, W, H);

        let settledCount = 0;

        for (const d of diceState) {
          if (!d.settled) {
            // Physics integration
            d.vz -= GRAVITY * dt;
            d.x  += d.vx * dt;
            d.y  += d.vy * dt;
            d.z  += d.vz * dt;
            d.angX += d.omegaX * dt;
            d.angY += d.omegaY * dt;
            d.angZ += d.omegaZ * dt;

            // ── Bar collision: bounce off left edge of bar ──
            const dieRight = d.x + halfDie;
            if (dieRight > barLeftX && d.vx > 0) {
              d.x = barLeftX - halfDie;
              d.vx = -Math.abs(d.vx) * 0.55;   // bounce back
              d.omegaZ += d.vx * 0.003;         // add spin from impact
              // Play sound on bar hit
              if (!soundPlayed) {
                soundPlayed = true;
                if (window.sounds) sounds.play('dice');
              }
            }

            // Ground bounce
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

              // Play sound on first ground impact
              if (!soundPlayed) {
                soundPlayed = true;
                if (window.sounds) sounds.play('dice');
              }

              if (newVz < 0.02 || d.bounces > d.maxBounces) {
                d.settled    = true;
                d.settleTime = now;
                d.vz = 0;
                // Compute nearest target rotation for correct face value
                const tgt = _FACE_TARGET[d.value] || { x: 0, y: 0 };
                d.finalAngX = _snapAngle(d.angX, tgt.x);
                d.finalAngY = _snapAngle(d.angY, tgt.y);
                d.finalAngZ = d.angZ + (Math.random() - 0.5) * 0.12;
              } else {
                d.vz = newVz;
              }
            }
          } else {
            settledCount++;
            d.x += (d.targetX - d.x) * 0.12;
            d.y += (d.targetY - d.y) * 0.12;
            d.angX += (d.finalAngX - d.angX) * 0.10;
            d.angY += (d.finalAngY - d.angY) * 0.10;
            d.angZ += (d.finalAngZ - d.angZ) * 0.10;
            d.omegaX *= 0.80;
            d.omegaY *= 0.80;
            d.omegaZ *= 0.80;
            d.vx *= 0.82;
            d.vy *= 0.82;
          }
        }

        // Draw both dice (no overlap possible due to separation)
        for (const d of diceState) {
          _drawShadow(ctx, d.x, d.y, d.z, halfDie);
          const visualSize = halfDie * (1 + Math.max(d.z, 0) * H_SCALE);
          _drawDie(ctx, d, visualSize);
        }

        // Resolve after settling + brief linger
        if (settledCount === diceState.length && resolveAt === null) {
          resolveAt = now + 280;
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

  // ── Show dice result (called from renderAll) ────────────────
  showDiceResult(dice, remainingDice, _currentPlayer) {
    this._remainingDice = [...remainingDice];

    // No dice → clear everything
    if (!dice || dice.length === 0) {
      this._removeCanvas();
      const container = document.getElementById('dice-animation-container');
      if (container) container.innerHTML = '';
      return;
    }

    this._allDice = [...dice];

    // If canvas is active, redraw with updated remaining state
    if (this._canvas && this._finalDice) {
      this._redrawStatic();
      return;
    }

    // Fallback: HTML dice (online mode or no animation ran)
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

      die.className = `die white ${!stillRemaining ? 'used' : ''}`;
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
        <div class="die white">${getDieFaceHTMLStatic(blackRoll)}</div>
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
