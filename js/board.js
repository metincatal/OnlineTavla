// SVG Board Renderer

class Board {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.onPointClick  = null;
    this.onPieceHover  = null;
    this.onDropMove    = null;   // callback(from, to) for drag-and-drop

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
  }

  /* ── SVG defs ─────────────────────────────────────────────────── */
  initDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    defs.appendChild(this._linearGrad('boardGrad', '#7B3C18', '#5A2810', '0%','0%','100%','100%'));

    const wg = this._radialGrad('wpGrad', '38%', '32%', '65%');
    this._stop(wg, '0%',   '#FFFFFF');
    this._stop(wg, '55%',  '#E4E4E4');
    this._stop(wg, '100%', '#B0B0B0');
    defs.appendChild(wg);

    const bg = this._radialGrad('bpGrad', '32%', '25%', '68%');
    this._stop(bg, '0%',   '#5A5A5A');
    this._stop(bg, '45%',  '#252525');
    this._stop(bg, '100%', '#070707');
    defs.appendChild(bg);

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'pieceShadow');
    filter.setAttribute('x', '-20%'); filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%'); filter.setAttribute('height', '140%');
    const fds = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    fds.setAttribute('dx', '1'); fds.setAttribute('dy', '2');
    fds.setAttribute('stdDeviation', '2');
    fds.setAttribute('flood-color', 'rgba(0,0,0,0.5)');
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

  /* ── Board background ─────────────────────────────────────────── */
  drawBoard() {
    this.svg.appendChild(this.rect(0, 0, SVG_WIDTH, SVG_HEIGHT, '#2A1006'));

    const inner = this.rect(BOARD_MARGIN, BOARD_MARGIN,
      SVG_WIDTH - BOARD_MARGIN*2, SVG_HEIGHT - BOARD_MARGIN*2, 'url(#boardGrad)');
    this.svg.appendChild(inner);

    const ib = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ib.setAttribute('x', BOARD_MARGIN + 3); ib.setAttribute('y', BOARD_MARGIN + 3);
    ib.setAttribute('width', SVG_WIDTH - BOARD_MARGIN*2 - 6);
    ib.setAttribute('height', SVG_HEIGHT - BOARD_MARGIN*2 - 6);
    ib.setAttribute('fill', 'none');
    ib.setAttribute('stroke', 'rgba(255,200,100,0.1)');
    ib.setAttribute('stroke-width', '2');
    ib.setAttribute('rx', '3');
    this.svg.appendChild(ib);
  }

  /* ── 24 triangular points ─────────────────────────────────────── */
  drawPoints() {
    const g = this.createGroup('points');
    for (let i = 1; i <= 24; i++) {
      const { x, y, isTop } = this.getPointPosition(i);
      const color = i % 2 === 1 ? '#8B0000' : '#C4A060';
      const tri = this.drawTriangle(x, y, POINT_WIDTH, POINT_HEIGHT, isTop, color);
      tri.setAttribute('data-point', i);
      tri.setAttribute('stroke', 'rgba(0,0,0,0.3)');
      tri.setAttribute('stroke-width', '1');
      tri.style.cursor = 'pointer';
      tri.addEventListener('click', () => this.handlePointClick(i));
      g.appendChild(tri);

    }
    this.svg.appendChild(g);
  }

  /* ── Bar divider ─────────────────────────────────────────────── */
  drawBar() {
    const barX = BOARD_MARGIN + 10 + 6 * POINT_WIDTH;
    const barY = BOARD_MARGIN;
    const barH = SVG_HEIGHT - BOARD_MARGIN * 2;
    const dividerX = barX + BAR_WIDTH / 2 - 2;

    // Thin 4px vertical divider line in the center of the bar area
    const divider = this.rect(dividerX, barY, 4, barH, 'rgba(200,140,50,0.5)');
    this.svg.appendChild(divider);

    // Transparent click/drag areas covering full bar width (for bar pieces)
    const topArea = this.rect(barX, barY, BAR_WIDTH, barH/2, 'transparent');
    topArea.style.cursor = 'pointer';
    topArea.setAttribute('data-point', '25');
    topArea.addEventListener('click', () => this.handlePointClick(25));
    this.svg.appendChild(topArea);

    const botArea = this.rect(barX, barY + barH/2, BAR_WIDTH, barH/2, 'transparent');
    botArea.style.cursor = 'pointer';
    botArea.setAttribute('data-point', '0');
    botArea.addEventListener('click', () => this.handlePointClick(0));
    this.svg.appendChild(botArea);
  }

  /* ── Bear-off tray ────────────────────────────────────────────── */
  drawBearOffAreas() {
    const offX = BOARD_MARGIN + 10 + 6*POINT_WIDTH + BAR_WIDTH + 6*POINT_WIDTH + 8;
    const offW  = SVG_WIDTH - BOARD_MARGIN - offX - 4;
    const halfH = SVG_HEIGHT/2 - BOARD_MARGIN;

    // White off (top) — drop target dest=25  [White home = points 19-24 = TOP]
    const wRect = this.rect(offX, BOARD_MARGIN, offW, halfH - 2, '#120600');
    wRect.setAttribute('rx','4'); wRect.setAttribute('stroke','rgba(180,100,30,0.4)');
    wRect.setAttribute('stroke-width','1.5');
    wRect.setAttribute('data-dest', '25');
    this.svg.appendChild(wRect);
    const wLabel = this.text(offX + offW/2, BOARD_MARGIN + 12, 'OFF', 'rgba(220,160,60,0.55)', 10);
    wLabel.style.pointerEvents = 'none';
    this.svg.appendChild(wLabel);

    // Black off (bottom) — drop target dest=0  [Black home = points 1-6 = BOTTOM]
    const bRect = this.rect(offX, SVG_HEIGHT/2 + 2, offW, halfH - 2, '#120600');
    bRect.setAttribute('rx','4'); bRect.setAttribute('stroke','rgba(180,100,30,0.4)');
    bRect.setAttribute('stroke-width','1.5');
    bRect.setAttribute('data-dest', '0');
    this.svg.appendChild(bRect);
    const bLabel = this.text(offX + offW/2, SVG_HEIGHT - BOARD_MARGIN - 10, 'OFF', 'rgba(220,160,60,0.55)', 10);
    bLabel.style.pointerEvents = 'none';
    this.svg.appendChild(bLabel);

    this._offX = offX; this._offW = offW;
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

          // Hover events on top piece
          if (j === absCount - 1) {
            piece.addEventListener('mouseenter', () => { if (!this._dragging) this._onHover(i); });
            piece.addEventListener('mouseleave', () => { if (!this._dragging) this.clearHoverHighlights(); });
          }

          this.piecesGroup.appendChild(piece);

          // Inner highlight ring on every piece
          const ring = this.circle(cx, pieceY, PIECE_RADIUS - 11,
            'none', isWhite ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', 1);
          ring.style.pointerEvents = 'none';
          this.piecesGroup.appendChild(ring);
        }
        // No count badge — pieces show their natural color at all depths
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
    const barCX  = BOARD_MARGIN + 10 + 6 * POINT_WIDTH + BAR_WIDTH / 2;
    const isBlack = playerColor === 'black';
    const fill    = isBlack ? 'url(#bpGrad)' : 'url(#wpGrad)';
    const stroke  = isBlack ? '#555' : '#CCC';
    const pointIdx = isBlack ? 25 : 0;

    const halfBarH = (SVG_HEIGHT/2 - BOARD_MARGIN) * 0.8;
    const n = Math.min(count, 4);
    const spacing = n > 1 ? Math.min(PIECE_RADIUS*2-4, halfBarH / (n-1)) : 0;
    const startY = isBlack
      ? BOARD_MARGIN + (SVG_HEIGHT/2 - BOARD_MARGIN)/2 - (n-1)*spacing/2
      : SVG_HEIGHT/2 + (SVG_HEIGHT/2 - BOARD_MARGIN)/2 - (n-1)*spacing/2;

    for (let j = 0; j < n; j++) {
      const cy = startY + j * spacing;
      const piece = this.circle(barCX, cy, PIECE_RADIUS - 2, fill, stroke, 1.5);
      piece.setAttribute('filter','url(#pieceShadow)');
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
      const pillY = isBlack
        ? startY - PIECE_RADIUS - 8
        : startY - PIECE_RADIUS - 8;
      const pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      pill.setAttribute('x', barCX - 16); pill.setAttribute('y', pillY - 9);
      pill.setAttribute('width', 32); pill.setAttribute('height', 17);
      pill.setAttribute('rx', 8); pill.setAttribute('fill', '#FFCC00');
      pill.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(pill);
      const label = this.text(barCX, pillY, `×${count}`, '#000', 11, true);
      label.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(label);
    }
  }

  /* ── Hover highlights ────────────────────────────────────────── */
  _onHover(point) {
    if (this.onPieceHover) this.onPieceHover(point);
  }

  showHoverHighlights(moves) {
    this.clearHoverHighlights();
    if (!moves || moves.length === 0) return;
    const destinations = [...new Set(moves.map(m => m.to))];
    const offCX = (this._offX || 1082) + (this._offW || 60) / 2;

    for (const dest of destinations) {
      let el;
      if (dest === 25) {
        // White bearing off → top off zone (White home = TOP)
        const cy = BOARD_MARGIN + (SVG_HEIGHT/2 - BOARD_MARGIN) * 0.5;
        el = this.circle(offCX, cy, 16, 'rgba(80,200,80,0.5)', 'rgba(80,200,80,0.85)', 2);
      } else if (dest === 0) {
        // Black bearing off → bottom off zone (Black home = BOTTOM)
        const cy = SVG_HEIGHT/2 + (SVG_HEIGHT/2 - BOARD_MARGIN) * 0.5;
        el = this.circle(offCX, cy, 16, 'rgba(80,200,80,0.5)', 'rgba(80,200,80,0.85)', 2);
      } else {
        // Regular point — dot near tip
        const { x, y, isTop } = this.getPointPosition(dest);
        const cx = x + POINT_WIDTH / 2;
        const dotY = isTop ? y + POINT_HEIGHT * 0.5 : y - POINT_HEIGHT * 0.5;
        el = this.circle(cx, dotY, 14, 'rgba(80,200,80,0.5)', 'rgba(80,200,80,0.85)', 2);
      }
      el.style.pointerEvents = 'none';
      el.setAttribute('data-dest', dest.toString());
      this.highlightsGroup.appendChild(el);
      this._highlightEls.push(el);
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
    // Only primary pointer (mouse left button or first touch)
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

    // Capture pointer so we keep receiving events even when finger moves off element
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _onPointerMove(e) {
    if (!this._dragPending || e.pointerId !== this._pointerId) return;

    // Always track last position for drop detection
    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;

    if (!this._dragging && Math.sqrt(dx*dx + dy*dy) > 8) {
      this._dragging = true;
      // Show valid destinations
      if (this.onPieceHover) this.onPieceHover(this._dragFrom);
      // Create ghost piece at current position
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

      // Use last tracked position (clientX/Y may be 0 on some mobile browsers at pointerup)
      const cx = e.clientX || this._lastPointerX;
      const cy = e.clientY || this._lastPointerY;

      // Find drop target — temporarily hide ghost so elementFromPoint sees what's underneath
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
      const barX = BOARD_MARGIN + 10 + 6 * POINT_WIDTH;
      const barY = point === 25 ? BOARD_MARGIN : SVG_HEIGHT/2;
      const barH = SVG_HEIGHT/2 - BOARD_MARGIN;
      h = this.rect(barX, barY, BAR_WIDTH, barH, color);
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

  /* ── Bear-off: chip side-view ────────────────────────────────── */
  renderBearOff(bearOffCounts) {
    if (!bearOffCounts) return;
    const { white, black } = bearOffCounts;
    const offX = this._offX || 1082;
    const offW = this._offW || 60;
    const chipW = offW - 14;
    const chipH = 10;
    const chipGap = 3;
    const chipX = offX + 7;

    // White off — stack from top down (White home = TOP, off area = TOP)
    const wTop = BOARD_MARGIN + 22;
    for (let i = 0; i < Math.min(white, 15); i++) {
      const cy = wTop + i * (chipH + chipGap);
      const chip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      chip.setAttribute('x', chipX); chip.setAttribute('y', cy);
      chip.setAttribute('width', chipW); chip.setAttribute('height', chipH);
      chip.setAttribute('rx', '3'); chip.setAttribute('fill', '#DEDEDE');
      chip.setAttribute('stroke', '#AAAAAA'); chip.setAttribute('stroke-width', '0.8');
      chip.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(chip);
      const shine = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shine.setAttribute('x', chipX+2); shine.setAttribute('y', cy+1);
      shine.setAttribute('width', chipW-4); shine.setAttribute('height', 2);
      shine.setAttribute('rx', '1'); shine.setAttribute('fill', 'rgba(255,255,255,0.7)');
      shine.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(shine);
    }
    if (white > 0) {
      const t = this.text(offX + offW/2, SVG_HEIGHT/2 - 12, `${white}`,
        'rgba(255,220,150,0.85)', 11, true);
      t.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(t);
    }

    // Black off — stack from bottom up (Black home = BOTTOM, off area = BOTTOM)
    const bBottom = SVG_HEIGHT - BOARD_MARGIN - 22;
    for (let i = 0; i < Math.min(black, 15); i++) {
      const cy = bBottom - i * (chipH + chipGap);
      const chip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      chip.setAttribute('x', chipX); chip.setAttribute('y', cy);
      chip.setAttribute('width', chipW); chip.setAttribute('height', chipH);
      chip.setAttribute('rx', '3'); chip.setAttribute('fill', '#282828');
      chip.setAttribute('stroke', '#555555'); chip.setAttribute('stroke-width', '0.8');
      chip.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(chip);
      const shine = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      shine.setAttribute('x', chipX+2); shine.setAttribute('y', cy+1);
      shine.setAttribute('width', chipW-4); shine.setAttribute('height', 2);
      shine.setAttribute('rx', '1'); shine.setAttribute('fill', 'rgba(255,255,255,0.12)');
      shine.style.pointerEvents = 'none';
      this.piecesGroup.appendChild(shine);
    }
    if (black > 0) {
      const t = this.text(offX + offW/2, SVG_HEIGHT/2 + 16, `${black}`,
        'rgba(255,220,150,0.85)', 11, true);
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
    const leftStart  = BOARD_MARGIN + 10;
    const rightStart = BOARD_MARGIN + 10 + 6 * POINT_WIDTH + BAR_WIDTH;
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
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const pts = pointDown
      ? `${x},${y} ${x+width},${y} ${x+width/2},${y+height}`
      : `${x},${y} ${x+width},${y} ${x+width/2},${y-height}`;
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', fill);
    return poly;
  }

  /* ── SVG element factories ────────────────────────────────────── */
  createGroup(id) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', id);
    return g;
  }
  rect(x, y, w, h, fill) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x',x); r.setAttribute('y',y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('fill',fill);
    return r;
  }
  circle(cx, cy, r, fill, stroke, sw) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r',r);
    c.setAttribute('fill',fill);
    if (stroke) c.setAttribute('stroke',stroke);
    if (sw)     c.setAttribute('stroke-width',sw);
    return c;
  }
  text(x, y, content, fill, fontSize, bold) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('fill',fill); t.setAttribute('font-size',fontSize||14);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    if (bold) t.setAttribute('font-weight','bold');
    t.textContent = content;
    return t;
  }
}
