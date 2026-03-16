// SVG Board Renderer — v2 (symmetric bear-off, narrow bar, 3D depth)

class Board {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.onPointClick  = null;
    this.onPieceHover  = null;
    this.onDropMove    = null;

    this._lastBoard    = null;
    this._highlightEls = [];

    // Drag state
    this._dragging     = false;
    this._dragPending  = false;
    this._dragFrom     = null;
    this._dragGhost    = null;
    this._dragStartX   = 0;
    this._dragStartY   = 0;
    this._lastPointerX = 0;
    this._lastPointerY = 0;
    this._suppressNextClick = false;
    this._pointerId    = null;

    // Layout derived constants
    this._lOffX  = BOARD_MARGIN + INNER_PAD;                       // left bear-off X
    this._ptsL   = this._lOffX + BEAR_OFF_WIDTH + 4;               // left points start
    this._barX   = this._ptsL + 6 * POINT_WIDTH;                   // bar X
    this._ptsR   = this._barX + BAR_WIDTH;                         // right points start
    this._rOffX  = this._ptsR + 6 * POINT_WIDTH + 4;               // right bear-off X

    this.init();
    this._initDrag();
  }

  init() {
    this.svg.innerHTML = '';
    this.svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    this.initDefs();
    this.drawBoard();
    this.drawPoints();
    this.drawBar();
    this.drawBearOffAreas();

    this.piecesGroup     = this.createGroup('pieces');
    this.highlightsGroup = this.createGroup('highlights');

    this.svg.appendChild(this.piecesGroup);
    this.svg.appendChild(this.highlightsGroup);

    // Move panels into board-wrapper for aligned positioning
    this._alignPanels();
  }

  _alignPanels() {
    const container = this.svg.parentElement; // .board-container
    if (!container) return;
    const panelBlack = document.getElementById('panel-black');
    const panelWhite = document.getElementById('panel-white');
    if (panelBlack && panelBlack.parentElement !== container) container.appendChild(panelBlack);
    if (panelWhite && panelWhite.parentElement !== container) container.appendChild(panelWhite);
  }

  /* ── SVG defs ─────────────────────────────────────────────────── */
  initDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    defs.appendChild(this._linearGrad('boardGrad', '#C09868', '#9A7040', '0%','0%','100%','100%'));

    const wg = this._radialGrad('wpGrad', '38%', '32%', '65%');
    this._stop(wg, '0%',   '#FAF5EC');
    this._stop(wg, '55%',  '#E8DEC8');
    this._stop(wg, '100%', '#C8B898');
    defs.appendChild(wg);

    const bg = this._radialGrad('bpGrad', '32%', '25%', '68%');
    this._stop(bg, '0%',   '#4A3A28');
    this._stop(bg, '45%',  '#1E1410');
    this._stop(bg, '100%', '#080604');
    defs.appendChild(bg);

    // Bar wood gradient
    defs.appendChild(this._linearGrad('barWoodGrad', '#2A1008', '#3E1A0C', '0%','0%','100%','0%'));
    // Hinge plate gradient (brass)
    defs.appendChild(this._linearGrad('hingeGrad', '#D4A838', '#9A7210', '0%','0%','0%','100%'));
    // Hinge barrel gradient
    defs.appendChild(this._linearGrad('hingeBarrelGrad', '#F0C840', '#C89018', '0%','0%','100%','0%'));
    // Screw head
    const sg = this._radialGrad('screwGrad', '35%', '32%', '65%');
    this._stop(sg, '0%',   '#F0D060');
    this._stop(sg, '100%', '#7A5A14');
    defs.appendChild(sg);

    // Inner shadow gradients for 3D depth
    const shT = this._linearGrad('shadowTop', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0)', '0%','0%','0%','100%');
    defs.appendChild(shT);
    const shB = this._linearGrad('shadowBot', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', '0%','0%','0%','100%');
    defs.appendChild(shB);
    const shL = this._linearGrad('shadowLeft', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0)', '0%','0%','100%','0%');
    defs.appendChild(shL);
    const shR = this._linearGrad('shadowRight', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', '0%','0%','100%','0%');
    defs.appendChild(shR);

    // Bear-off tray inner shadows (sunken effect)
    const boShT = this._linearGrad('bearOffShadowTop', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', '0%','0%','0%','100%');
    defs.appendChild(boShT);
    const boShL = this._linearGrad('bearOffShadowLeft', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', '0%','0%','100%','0%');
    defs.appendChild(boShL);
    const boShR = this._linearGrad('bearOffShadowRight', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', '0%','0%','100%','0%');
    defs.appendChild(boShR);

    // Piece shadow filter
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'pieceShadow');
    filter.setAttribute('x', '-20%'); filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%'); filter.setAttribute('height', '140%');
    const fds = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fds.setAttribute('dx', '1'); fds.setAttribute('dy', '2.5');
    fds.setAttribute('stdDeviation', '2.5');
    fds.setAttribute('flood-color', 'rgba(0,0,0,0.55)');
    filter.appendChild(fds);
    defs.appendChild(filter);

    this.svg.appendChild(defs);
  }

  _linearGrad(id, c1, c2, x1, y1, x2, y2) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    g.setAttribute('id', id);
    g.setAttribute('x1',x1); g.setAttribute('y1',y1);
    g.setAttribute('x2',x2); g.setAttribute('y2',y2);
    this._stop(g,'0%',c1); this._stop(g,'100%',c2);
    return g;
  }
  _radialGrad(id, cx, cy, r) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    g.setAttribute('id',id); g.setAttribute('cx',cx);
    g.setAttribute('cy',cy); g.setAttribute('r',r);
    return g;
  }
  _stop(grad, offset, color) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s.setAttribute('offset', offset); s.setAttribute('stop-color', color);
    grad.appendChild(s);
  }

  /* ── Board background — TWO separate halves joined by bar ────────── */
  drawBoard() {
    const ix = BOARD_MARGIN, iy = BOARD_MARGIN;
    const ih = SVG_HEIGHT - BOARD_MARGIN * 2;
    const barX = this._barX;
    const barW = BAR_WIDTH;
    const barR = barX + barW;

    // Outer frame (dark walnut) with rounded corners
    const frame = this.rect(0, 0, SVG_WIDTH, SVG_HEIGHT, '#3A1A08');
    frame.setAttribute('rx', '8');
    this.svg.appendChild(frame);

    // ── LEFT half playing surface ──
    const lw = barX - ix;
    const lSurf = this.rect(ix, iy, lw, ih, 'url(#boardGrad)');
    lSurf.setAttribute('rx', '4');
    this.svg.appendChild(lSurf);

    const lBord = this.rect(ix + 2, iy + 2, lw - 4, ih - 4, 'none');
    lBord.setAttribute('stroke', 'rgba(255,200,100,0.1)');
    lBord.setAttribute('stroke-width', '2');
    lBord.setAttribute('rx', '3');
    this.svg.appendChild(lBord);

    // ── RIGHT half playing surface ──
    const rw = SVG_WIDTH - BOARD_MARGIN - barR;
    const rSurf = this.rect(barR, iy, rw, ih, 'url(#boardGrad)');
    rSurf.setAttribute('rx', '4');
    this.svg.appendChild(rSurf);

    const rBord = this.rect(barR + 2, iy + 2, rw - 4, ih - 4, 'none');
    rBord.setAttribute('stroke', 'rgba(255,200,100,0.1)');
    rBord.setAttribute('stroke-width', '2');
    rBord.setAttribute('rx', '3');
    this.svg.appendChild(rBord);

    // ── 3D depth shadows for each half ──
    const sh = 14;
    // Left half
    this.svg.appendChild(this.rect(ix, iy, lw, sh, 'url(#shadowTop)'));
    this.svg.appendChild(this.rect(ix, iy + ih - sh, lw, sh, 'url(#shadowBot)'));
    this.svg.appendChild(this.rect(ix, iy, sh, ih, 'url(#shadowLeft)'));
    this.svg.appendChild(this.rect(ix + lw - sh, iy, sh, ih, 'url(#shadowRight)'));
    // Right half
    this.svg.appendChild(this.rect(barR, iy, rw, sh, 'url(#shadowTop)'));
    this.svg.appendChild(this.rect(barR, iy + ih - sh, rw, sh, 'url(#shadowBot)'));
    this.svg.appendChild(this.rect(barR, iy, sh, ih, 'url(#shadowLeft)'));
    this.svg.appendChild(this.rect(barR + rw - sh, iy, sh, ih, 'url(#shadowRight)'));

    // ── Dark edge rails (between frame and triangle bases) ──
    const railH = 10;
    const railColor = COLORS.barBg;
    // Left half
    this.svg.appendChild(this.rect(ix, iy, lw, railH, railColor));
    this.svg.appendChild(this.rect(ix, iy + ih - railH, lw, railH, railColor));
    // Right half
    this.svg.appendChild(this.rect(barR, iy, rw, railH, railColor));
    this.svg.appendChild(this.rect(barR, iy + ih - railH, rw, railH, railColor));
  }

  /* ── 24 triangular points with rounded tips ────────────────────── */
  drawPoints() {
    const g = this.createGroup('points');
    for (let i = 1; i <= 24; i++) {
      const { x, y, isTop } = this.getPointPosition(i);
      const color = i % 2 === 1 ? COLORS.pointDark : COLORS.pointLight;
      const tri = this.drawTriangle(x, y, POINT_WIDTH, POINT_HEIGHT, isTop, color);
      tri.setAttribute('data-point', i);
      tri.setAttribute('stroke', 'rgba(0,0,0,0.25)');
      tri.setAttribute('stroke-width', '1');
      tri.setAttribute('stroke-linejoin', 'round');
      tri.style.cursor = 'pointer';
      tri.addEventListener('click', () => this.handlePointClick(i));
      g.appendChild(tri);
    }
    this.svg.appendChild(g);
  }

  /* ── Bar / spine with hinges + fold line ───────────────────────── */
  drawBar() {
    const barX = this._barX;
    const barY = BOARD_MARGIN;
    const barH = SVG_HEIGHT - BOARD_MARGIN * 2;
    const barW = BAR_WIDTH;

    // Wood background — no rx, flush with frame top/bottom
    const wood = this.rect(barX, barY, barW, barH, 'url(#barWoodGrad)');
    this.svg.appendChild(wood);

    // Wood grain lines
    for (let i = 1; i <= 4; i++) {
      const gx = barX + (i / 5) * barW;
      const gl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gl.setAttribute('x1', gx); gl.setAttribute('y1', barY);
      gl.setAttribute('x2', gx); gl.setAttribute('y2', barY + barH);
      gl.setAttribute('stroke', `rgba(0,0,0,${0.04 + (i % 2) * 0.03})`);
      gl.setAttribute('stroke-width', '1');
      gl.style.pointerEvents = 'none';
      this.svg.appendChild(gl);
    }

    // ── Center crease — extends through entire board (outer frame included) ──
    // This is where the two board halves' outer frames meet
    const foldCX = barX + barW / 2;

    const creaseShadow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    creaseShadow.setAttribute('x1', foldCX - 1); creaseShadow.setAttribute('y1', 0);
    creaseShadow.setAttribute('x2', foldCX - 1); creaseShadow.setAttribute('y2', SVG_HEIGHT);
    creaseShadow.setAttribute('stroke', 'rgba(0,0,0,0.5)');
    creaseShadow.setAttribute('stroke-width', '1.5');
    creaseShadow.style.pointerEvents = 'none';
    this.svg.appendChild(creaseShadow);

    const creaseHighlight = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    creaseHighlight.setAttribute('x1', foldCX + 1); creaseHighlight.setAttribute('y1', 0);
    creaseHighlight.setAttribute('x2', foldCX + 1); creaseHighlight.setAttribute('y2', SVG_HEIGHT);
    creaseHighlight.setAttribute('stroke', 'rgba(255,180,80,0.2)');
    creaseHighlight.setAttribute('stroke-width', '1');
    creaseHighlight.style.pointerEvents = 'none';
    this.svg.appendChild(creaseHighlight);

    // ── Bar edge lines — connect bar edges to dark rails ──
    // These show each half's inner frame terminating at the bar
    const railH = 10;
    const edgeColor = 'rgba(0,0,0,0.3)';
    const edgeHi    = 'rgba(255,180,80,0.12)';
    const iy = BOARD_MARGIN, ih = SVG_HEIGHT - BOARD_MARGIN * 2;

    // Left bar edge → rails
    for (const [y1, y2] of [[iy, iy + railH], [iy + ih - railH, iy + ih]]) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', barX); el.setAttribute('y1', y1);
      el.setAttribute('x2', barX); el.setAttribute('y2', y2);
      el.setAttribute('stroke', edgeColor); el.setAttribute('stroke-width', '1.5');
      el.style.pointerEvents = 'none';
      this.svg.appendChild(el);
    }

    // Right bar edge → rails
    for (const [y1, y2] of [[iy, iy + railH], [iy + ih - railH, iy + ih]]) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      el.setAttribute('x1', barX + barW); el.setAttribute('y1', y1);
      el.setAttribute('x2', barX + barW); el.setAttribute('y2', y2);
      el.setAttribute('stroke', edgeColor); el.setAttribute('stroke-width', '1.5');
      el.style.pointerEvents = 'none';
      this.svg.appendChild(el);
    }

    // Two hinges at ~22% and ~78% of bar height
    this._drawHinge(barX, barW, barY + barH * 0.22);
    this._drawHinge(barX, barW, barY + barH * 0.78);

    // Transparent click areas for bar pieces
    const topArea = this.rect(barX, barY, barW, barH / 2, 'transparent');
    topArea.style.cursor = 'pointer';
    topArea.setAttribute('data-point', '25');
    topArea.addEventListener('click', () => this.handlePointClick(25));
    this.svg.appendChild(topArea);

    const botArea = this.rect(barX, barY + barH / 2, barW, barH / 2, 'transparent');
    botArea.style.cursor = 'pointer';
    botArea.setAttribute('data-point', '0');
    botArea.addEventListener('click', () => this.handlePointClick(0));
    this.svg.appendChild(botArea);
  }

  _drawHinge(barX, barW, centerY) {
    const plateW = barW - 6;
    const plateH = 38;
    const plateX = barX + 3;

    // Drop shadow
    const shadow = this.rect(plateX + 2, centerY - plateH / 2 + 2, plateW, plateH, 'rgba(0,0,0,0.4)');
    shadow.setAttribute('rx', '4'); shadow.style.pointerEvents = 'none';
    this.svg.appendChild(shadow);

    // Brass plate
    const plate = this.rect(plateX, centerY - plateH / 2, plateW, plateH, 'url(#hingeGrad)');
    plate.setAttribute('rx', '4'); plate.style.pointerEvents = 'none';
    this.svg.appendChild(plate);

    // Center barrel (pivot cylinder)
    const plateCX = barX + barW / 2;
    const bW = 14; const bH = plateH + 8;
    const barrel = this.rect(plateCX - bW / 2, centerY - bH / 2, bW, bH, 'url(#hingeBarrelGrad)');
    barrel.setAttribute('rx', '4');
    barrel.setAttribute('class', 'hinge-barrel');
    barrel.style.pointerEvents = 'none';
    this.svg.appendChild(barrel);

    // Barrel knuckle lines
    for (let i = 0; i < 3; i++) {
      const ky = centerY - bH / 2 + 6 + i * (bH - 12) / 2;
      const kl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      kl.setAttribute('x1', plateCX - bW / 2 + 2); kl.setAttribute('y1', ky);
      kl.setAttribute('x2', plateCX + bW / 2 - 2); kl.setAttribute('y2', ky);
      kl.setAttribute('stroke', 'rgba(255,210,80,0.45)'); kl.setAttribute('stroke-width', '1');
      kl.style.pointerEvents = 'none';
      this.svg.appendChild(kl);
    }

    // 4 screws (smaller, positioned for narrow plate)
    const sx1 = plateX + 10, sx2 = plateX + plateW - 10;
    const sy1 = centerY - 11, sy2 = centerY + 11;
    for (const [sx, sy] of [[sx1,sy1],[sx2,sy1],[sx1,sy2],[sx2,sy2]]) {
      const screw = this.circle(sx, sy, 4, 'url(#screwGrad)', '#8B6A20', 0.7);
      screw.style.pointerEvents = 'none';
      this.svg.appendChild(screw);
      const slot = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slot.setAttribute('x1', sx - 2.5); slot.setAttribute('y1', sy);
      slot.setAttribute('x2', sx + 2.5); slot.setAttribute('y2', sy);
      slot.setAttribute('stroke', '#6A5010'); slot.setAttribute('stroke-width', '1.5');
      slot.style.pointerEvents = 'none';
      this.svg.appendChild(slot);
    }

    // Top shine
    const shine = this.rect(plateX + 4, centerY - plateH / 2 + 2, plateW - 8, 2.5, 'rgba(255,240,150,0.35)');
    shine.setAttribute('rx', '2'); shine.style.pointerEvents = 'none';
    this.svg.appendChild(shine);
  }

  /* ── Symmetric Bear-off trays (left + right) — single piece, flush with frame ── */
  drawBearOffAreas() {
    const iy = BOARD_MARGIN;
    const ih = SVG_HEIGHT - BOARD_MARGIN * 2;

    // Tray spans from frame edge to just before triangles — no gap
    const lx = BOARD_MARGIN;
    const lw = this._ptsL - BOARD_MARGIN - 2;
    const rx = this._rOffX - 2;
    const rw = SVG_WIDTH - BOARD_MARGIN - rx;

    const _makeTray = (x, y, w, h, dest) => {
      // Outer recess shadow
      const recess = this.rect(x - 1, y, w + 1, h, 'rgba(0,0,0,0.35)');
      recess.setAttribute('rx', '4');
      recess.style.pointerEvents = 'none';
      this.svg.appendChild(recess);

      // Main tray — single continuous piece
      const tray = this.rect(x, y, w, h, '#0E0600');
      tray.setAttribute('rx', '4');
      tray.setAttribute('stroke', 'rgba(140,80,20,0.25)');
      tray.setAttribute('stroke-width', '1');
      tray.setAttribute('data-dest', String(dest));
      tray.style.cursor = 'pointer';
      tray.addEventListener('click', () => this.handlePointClick(dest));
      this.svg.appendChild(tray);

      // Inner shadow — top edge (sunken effect)
      const shTop = this.rect(x + 2, y + 2, w - 4, 12, 'url(#bearOffShadowTop)');
      shTop.setAttribute('rx', '3');
      shTop.style.pointerEvents = 'none';
      this.svg.appendChild(shTop);

      // Inner shadow — left edge
      const shLeft = this.rect(x + 2, y + 2, 5, h - 4, 'url(#bearOffShadowLeft)');
      shLeft.setAttribute('rx', '2');
      shLeft.style.pointerEvents = 'none';
      this.svg.appendChild(shLeft);

      // Inner shadow — right edge
      const shRight = this.rect(x + w - 7, y + 2, 5, h - 4, 'url(#bearOffShadowRight)');
      shRight.setAttribute('rx', '2');
      shRight.style.pointerEvents = 'none';
      this.svg.appendChild(shRight);

      // Bottom highlight
      const hlBot = this.rect(x + 5, y + h - 5, w - 10, 3, 'rgba(160,110,50,0.1)');
      hlBot.setAttribute('rx', '2');
      hlBot.style.pointerEvents = 'none';
      this.svg.appendChild(hlBot);
    };

    // LEFT bear-off (Black — dest 0) — single full-height tray
    _makeTray(lx, iy, lw, ih, 0);

    // RIGHT bear-off (White — dest 25) — single full-height tray
    _makeTray(rx, iy, rw, ih, 25);
  }

  /* ── Main render ─────────────────────────────────────────────── */
  render(board, _sp, _vm, _dice, _player, bearOffCounts) {
    this._lastBoard = board;
    this.piecesGroup.innerHTML     = '';
    this.highlightsGroup.innerHTML = '';
    this._highlightEls = [];

    this.renderPieces(board);
    this.renderBearOff(bearOffCounts);
  }

  /* ── Pieces ──────────────────────────────────────────────────── */
  renderPieces(board) {
    for (let i = 0; i <= 25; i++) {
      const count = board[i];
      if (count === 0) continue;

      if (i === 0) {
        this.drawBarPieces(count, 'white');
      } else if (i === 25) {
        this.drawBarPieces(Math.abs(count), 'black');
      } else {
        const { x, y, isTop } = this.getPointPosition(i);
        const cx = x + POINT_WIDTH / 2;
        const isWhite = count > 0;
        const absCount = Math.abs(count);
        const fill   = isWhite ? 'url(#wpGrad)' : 'url(#bpGrad)';
        const stroke = isWhite ? '#CCCCCC' : '#555555';
        const spacing = this._pieceSpacing(absCount);

        for (let j = 0; j < absCount; j++) {
          const pieceY = isTop
            ? y + PIECE_RADIUS + j * spacing
            : y - PIECE_RADIUS - j * spacing;

          const piece = this.circle(cx, pieceY, PIECE_RADIUS - 2, fill, stroke, 1.5);
          piece.setAttribute('filter', 'url(#pieceShadow)');
          piece.setAttribute('data-point', i);
          piece.style.cursor = 'pointer';
          piece.addEventListener('click', () => this.handlePointClick(i));

          if (j === absCount - 1) {
            piece.addEventListener('mouseenter', () => { if (!this._dragging) this._onHover(i); });
            piece.addEventListener('mouseleave', () => { if (!this._dragging) this.clearHoverHighlights(); });
          }

          this.piecesGroup.appendChild(piece);

          // Inner highlight ring
          const ring = this.circle(cx, pieceY, PIECE_RADIUS - 11,
            'none', isWhite ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', 1);
          ring.style.pointerEvents = 'none';
          this.piecesGroup.appendChild(ring);
        }
      }
    }
  }

  _pieceSpacing(count) {
    const normal   = PIECE_RADIUS * 2 - 4;
    if (count <= 1) return 0;
    const maxAvail = POINT_HEIGHT - PIECE_RADIUS * 2;
    return Math.min(normal, Math.floor(maxAvail / (count - 1)));
  }

  drawBarPieces(count, playerColor) {
    const barCX  = this._barX + BAR_WIDTH / 2;
    const isBlack = playerColor === 'black';
    const fill    = isBlack ? 'url(#bpGrad)' : 'url(#wpGrad)';
    const stroke  = isBlack ? '#555' : '#CCC';
    const pointIdx = isBlack ? 25 : 0;

    const halfBarH = (SVG_HEIGHT / 2 - BOARD_MARGIN) * 0.8;
    const n = Math.min(count, 4);
    const spacing = n > 1 ? Math.min(PIECE_RADIUS * 2 - 4, halfBarH / (n - 1)) : 0;
    const startY = isBlack
      ? BOARD_MARGIN + (SVG_HEIGHT / 2 - BOARD_MARGIN) / 2 - (n - 1) * spacing / 2
      : SVG_HEIGHT / 2 + (SVG_HEIGHT / 2 - BOARD_MARGIN) / 2 - (n - 1) * spacing / 2;

    for (let j = 0; j < n; j++) {
      const cy = startY + j * spacing;
      const piece = this.circle(barCX, cy, PIECE_RADIUS - 2, fill, stroke, 1.5);
      piece.setAttribute('filter', 'url(#pieceShadow)');
      piece.setAttribute('data-point', pointIdx);
      piece.style.cursor = 'pointer';
      piece.addEventListener('click', () => this.handlePointClick(pointIdx));
      if (j === n - 1) {
        piece.addEventListener('mouseenter', () => { if (!this._dragging) this._onHover(pointIdx); });
        piece.addEventListener('mouseleave', () => { if (!this._dragging) this.clearHoverHighlights(); });
      }
      this.piecesGroup.appendChild(piece);

      const ring = this.circle(barCX, cy, PIECE_RADIUS - 11, 'none',
        isBlack ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)', 1);
      ring.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(ring);
    }

    if (count > 0) {
      const pillY = startY - PIECE_RADIUS - 8;
      const pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pill.setAttribute('x', barCX - 14); pill.setAttribute('y', pillY - 8);
      pill.setAttribute('width', 28); pill.setAttribute('height', 16);
      pill.setAttribute('rx', 8); pill.setAttribute('fill', '#FFCC00');
      pill.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(pill);
      const label = this.text(barCX, pillY, `×${count}`, '#000', 10, true);
      label.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(label);
    }
  }

  /* ── Hover / ghost highlights ────────────────────────────────── */
  _onHover(point) {
    if (this.onPieceHover) this.onPieceHover(point);
  }

  showGhostHighlights(destinations, isWhite, board) {
    this.clearHoverHighlights();
    if (!destinations || destinations.length === 0) return;

    const fill   = isWhite ? 'url(#wpGrad)' : 'url(#bpGrad)';
    const stroke = isWhite ? '#CCCCCC'       : '#555555';
    const rTrayX = this._rOffX - 2;
    const rTrayW = SVG_WIDTH - BOARD_MARGIN - rTrayX;
    const rOffCX = rTrayX + rTrayW / 2;
    const lOffCX = BOARD_MARGIN + (this._ptsL - BOARD_MARGIN - 2) / 2;

    for (const { to, diceSum } of destinations) {
      let cx, cy;

      if (to === 25) {
        // White bear-off → right side
        cx = rOffCX;
        cy = BOARD_MARGIN + (SVG_HEIGHT / 2 - BOARD_MARGIN) * 0.5;
      } else if (to === 0) {
        // Black bear-off → left side
        cx = lOffCX;
        cy = SVG_HEIGHT / 2 + (SVG_HEIGHT / 2 - BOARD_MARGIN) * 0.5;
      } else {
        const { x, y, isTop } = this.getPointPosition(to);
        cx = x + POINT_WIDTH / 2;
        const existingCount = Math.abs(board[to]);
        const spacing = this._pieceSpacing(existingCount + 1);
        cy = isTop
          ? y + PIECE_RADIUS + existingCount * spacing
          : y - PIECE_RADIUS - existingCount * spacing;
      }

      const ghost = this.circle(cx, cy, PIECE_RADIUS - 2, fill, stroke, 1.5);
      ghost.setAttribute('opacity', '0.38');
      ghost.style.pointerEvents = 'none';
      this.highlightsGroup.appendChild(ghost);
      this._highlightEls.push(ghost);

      const labelColor = isWhite ? '#222' : '#EEE';
      const label = this.text(cx, cy, String(diceSum), labelColor, 13, true);
      label.style.pointerEvents = 'none';
      this.highlightsGroup.appendChild(label);
      this._highlightEls.push(label);
    }
  }

  clearHoverHighlights() {
    for (const el of this._highlightEls) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this._highlightEls = [];
  }

  /* ── Drag-and-drop ───────────────────────────────────────────── */
  _initDrag() {
    this.svg.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    document.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
    document.addEventListener('pointerup',   (e) => this._onPointerUp(e));
    document.addEventListener('pointercancel', (e) => this._onPointerUp(e));
  }

  _onPointerDown(e) {
    if (this._dragPending || this._dragging) return;
    if (e.button !== undefined && e.button !== 0) return;

    const fromPoint = this._getPointFromElement(e.target);
    if (fromPoint === null) return;

    this._dragPending = true;
    this._dragFrom = fromPoint;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;
    this._pointerId = e.pointerId;

    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _onPointerMove(e) {
    if (!this._dragPending || e.pointerId !== this._pointerId) return;

    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;

    if (!this._dragging && Math.sqrt(dx * dx + dy * dy) > 8) {
      this._dragging = true;
      if (this.onPieceHover) this.onPieceHover(this._dragFrom);
      const svgPt = this._screenToSVG(e.clientX, e.clientY);
      this._createGhost(svgPt.x, svgPt.y);
    }

    if (this._dragging) {
      e.preventDefault();
      const svgPt = this._screenToSVG(e.clientX, e.clientY);
      if (this._dragGhost) {
        this._dragGhost.setAttribute('cx', svgPt.x);
        this._dragGhost.setAttribute('cy', svgPt.y);
      }
    }
  }

  _onPointerUp(e) {
    if (!this._dragPending || e.pointerId !== this._pointerId) return;

    const wasDragging = this._dragging;
    this._dragging    = false;
    this._dragPending = false;
    this._pointerId   = null;

    if (this._dragGhost) {
      this._dragGhost.remove();
      this._dragGhost = null;
    }
    this.clearHoverHighlights();

    if (wasDragging) {
      this._suppressNextClick = true;
      setTimeout(() => { this._suppressNextClick = false; }, 150);

      const cx = e.clientX || this._lastPointerX;
      const cy = e.clientY || this._lastPointerY;

      const el = document.elementFromPoint(cx, cy);
      const destStr = this._findAttr(el, ['data-dest', 'data-point']);
      if (destStr !== null && this.onDropMove) {
        this.onDropMove(this._dragFrom, parseInt(destStr));
      }
    }
  }

  _getPointFromElement(el) {
    let node = el;
    while (node && node !== this.svg) {
      const v = node.getAttribute && node.getAttribute('data-point');
      if (v !== null && v !== undefined) return parseInt(v);
      node = node.parentElement;
    }
    return null;
  }

  _findAttr(el, attrs) {
    let node = el;
    while (node) {
      for (const attr of attrs) {
        const v = node.getAttribute && node.getAttribute(attr);
        if (v !== null && v !== undefined) return v;
      }
      node = node.parentElement;
    }
    return null;
  }

  _screenToSVG(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  _createGhost(x, y) {
    const v = this._lastBoard ? this._lastBoard[this._dragFrom] : 1;
    const isWhite = (this._dragFrom === 0) ? true : (this._dragFrom === 25) ? false : v > 0;
    const ghost = this.circle(x, y, PIECE_RADIUS - 2,
      isWhite ? 'url(#wpGrad)' : 'url(#bpGrad)',
      isWhite ? '#CCC' : '#555', 1.5);
    ghost.setAttribute('opacity', '0.65');
    ghost.setAttribute('pointer-events', 'none');
    ghost.style.pointerEvents = 'none';
    this._dragGhost = ghost;
    this.highlightsGroup.appendChild(ghost);
  }

  /* ── Flash for AI moves ──────────────────────────────────────── */
  flashPoint(point, color = '#FFD700') {
    if (point === null || point === undefined) return;
    let h;
    if (point === 0 || point === 25) {
      const barY = point === 25 ? BOARD_MARGIN : SVG_HEIGHT / 2;
      const barH = SVG_HEIGHT / 2 - BOARD_MARGIN;
      h = this.rect(this._barX, barY, BAR_WIDTH, barH, color);
      h.setAttribute('opacity', '0.4');
    } else {
      const { x, y, isTop } = this.getPointPosition(point);
      h = this.drawTriangle(x, y, POINT_WIDTH, POINT_HEIGHT, isTop, color);
      h.setAttribute('opacity', '0.45');
    }
    h.style.pointerEvents = 'none';
    this.highlightsGroup.appendChild(h);
    setTimeout(() => { if (h.parentNode) h.parentNode.removeChild(h); }, 450);
  }

  /* ── Bear-off: chip side-view on BOTH sides ────────────────────── */
  renderBearOff(bearOffCounts) {
    if (!bearOffCounts) return;
    const { white, black } = bearOffCounts;
    const chipH = 10;
    const chipGap = 3;

    // Tray centers (matching drawBearOffAreas flush layout)
    const lTrayCX = BOARD_MARGIN + (this._ptsL - BOARD_MARGIN - 2) / 2;
    const rTrayX  = this._rOffX - 2;
    const rTrayW  = SVG_WIDTH - BOARD_MARGIN - rTrayX;
    const rTrayCX = rTrayX + rTrayW / 2;
    const chipW   = BEAR_OFF_WIDTH - 10;

    // ── Right side: White borne-off pieces ──
    const rChipX = rTrayCX - chipW / 2;
    const wTop = BOARD_MARGIN + 22;
    for (let i = 0; i < Math.min(white, 15); i++) {
      const cy = wTop + i * (chipH + chipGap);
      const chip = this.rect(rChipX, cy, chipW, chipH, '#DEDEDE');
      chip.setAttribute('rx', '3');
      chip.setAttribute('stroke', '#AAAAAA'); chip.setAttribute('stroke-width', '0.8');
      chip.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(chip);
      const shine = this.rect(rChipX + 2, cy + 1, chipW - 4, 2, 'rgba(255,255,255,0.7)');
      shine.setAttribute('rx', '1'); shine.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(shine);
    }
    if (white > 0) {
      const t = this.text(rTrayCX, SVG_HEIGHT / 2 - 10, `${white}`,
        'rgba(255,220,150,0.95)', 16, true);
      t.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(t);
    }

    // ── Left side: Black borne-off pieces ──
    const lChipX = lTrayCX - chipW / 2;
    const bTop = BOARD_MARGIN + 22;
    for (let i = 0; i < Math.min(black, 15); i++) {
      const cy = bTop + i * (chipH + chipGap);
      const chip = this.rect(lChipX, cy, chipW, chipH, '#282828');
      chip.setAttribute('rx', '3');
      chip.setAttribute('stroke', '#555555'); chip.setAttribute('stroke-width', '0.8');
      chip.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(chip);
      const shine = this.rect(lChipX + 2, cy + 1, chipW - 4, 2, 'rgba(255,255,255,0.12)');
      shine.setAttribute('rx', '1'); shine.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(shine);
    }
    if (black > 0) {
      const t = this.text(lTrayCX, SVG_HEIGHT / 2 - 10, `${black}`,
        'rgba(255,220,150,0.95)', 16, true);
      t.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(t);
    }
  }

  /* ── Point click ─────────────────────────────────────────────── */
  handlePointClick(point) {
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    if (this.onPointClick) this.onPointClick(point);
  }

  /* ── Geometry helpers ────────────────────────────────────────── */
  getPointPosition(point) {
    const leftStart  = this._ptsL;
    const rightStart = this._ptsR;
    const topY    = BOARD_MARGIN + 10;
    const bottomY = SVG_HEIGHT - BOARD_MARGIN - 10;

    if (point >= 13 && point <= 18) {
      return { x: leftStart  + (point - 13) * POINT_WIDTH, y: topY,    isTop: true  };
    } else if (point >= 19 && point <= 24) {
      return { x: rightStart + (point - 19) * POINT_WIDTH, y: topY,    isTop: true  };
    } else if (point >= 1 && point <= 6) {
      return { x: rightStart + (6 - point)  * POINT_WIDTH, y: bottomY, isTop: false };
    } else {
      return { x: leftStart  + (12 - point) * POINT_WIDTH, y: bottomY, isTop: false };
    }
  }

  drawTriangle(x, y, width, height, pointDown, fill) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const cx = x + width / 2;
    const tr = TIP_ROUND;
    const inset = tr * 1.2;

    if (pointDown) {
      const tipY = y + height;
      path.setAttribute('d',
        `M ${x},${y} L ${x + width},${y} ` +
        `L ${cx + tr},${tipY - inset} ` +
        `Q ${cx},${tipY} ${cx - tr},${tipY - inset} Z`
      );
    } else {
      const tipY = y - height;
      path.setAttribute('d',
        `M ${x},${y} L ${x + width},${y} ` +
        `L ${cx + tr},${tipY + inset} ` +
        `Q ${cx},${tipY} ${cx - tr},${tipY + inset} Z`
      );
    }

    path.setAttribute('fill', fill);
    return path;
  }

  /* ── SVG element factories ────────────────────────────────────── */
  createGroup(id) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', id);
    return g;
  }
  rect(x, y, w, h, fill) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('fill', fill);
    return r;
  }
  circle(cx, cy, r, fill, stroke, sw) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
    c.setAttribute('fill', fill);
    if (stroke) c.setAttribute('stroke', stroke);
    if (sw)     c.setAttribute('stroke-width', sw);
    return c;
  }
  text(x, y, content, fill, fontSize, bold) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x); t.setAttribute('y', y);
    t.setAttribute('fill', fill); t.setAttribute('font-size', fontSize || 14);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
    if (bold) t.setAttribute('font-weight', 'bold');
    t.textContent = content;
    return t;
  }
}
