'use strict';
/**
 * games/gomoku/game.js
 * "오목" — Gomoku (Five in a Row)
 *
 * Shared board, 1/2/4 players.
 * Each panel shows the full board; players take turns placing stones.
 * Bottom lightbox glows when it's your turn.
 *
 * Stone colors: 흑(P1) #1e1e1e, 백(P2) #f5ede0, 청(P3) #3b82f6, 홍(P4) #ef4444
 * For 1-player: single panel, player alternates between 흑 and 백.
 */

(function registerGomoku() {

  const BOARD_SIZE  = 15;
  const STONE_COLORS = [
    { name: '흑', fill: '#1e1e1e', border: '#555',    label: '#ffffff' },
    { name: '백', fill: '#f5ede0', border: '#bbb',    label: '#333333' },
    { name: '청', fill: '#3b82f6', border: '#1d4ed8', label: '#ffffff' },
    { name: '홍', fill: '#ef4444', border: '#b91c1c', label: '#ffffff' },
  ];

  /* ── Coordinator ─────────────────────────────────────────────── */
  function createCoordinator(numPanels) {
    /* For 1-panel: 2 colors (흑/백), the single panel controls both */
    const numColors = numPanels === 1 ? 2 : numPanels;

    const board = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(-1));
    let currentColor = 0; /* index into STONE_COLORS */
    let gameOver = false;
    let panels = [];
    let started = false;

    function broadcast(ev, data) { panels.forEach(p => p.cb[ev]?.(data)); }

    function findWin(r, c, color) {
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let s = 1; s <= 4; s++) {
          const nr = r + dr*s, nc = c + dc*s;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr][nc] === color) cells.push([nr, nc]); else break;
        }
        for (let s = 1; s <= 4; s++) {
          const nr = r - dr*s, nc = c - dc*s;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr][nc] === color) cells.push([nr, nc]); else break;
        }
        if (cells.length >= 5) return cells;
      }
      return null;
    }

    const _c = {
      _gameover: false,
      numColors,
      getBoard()        { return board; },
      getCurrentColor() { return currentColor; },

      register(panelIdx, cb) {
        panels.push({ panelIdx, cb });
        if (!started && panels.length >= numPanels) {
          started = true;
          setTimeout(() => broadcast('turnChange', { color: currentColor }), 300);
        }
      },

      place(panelIdx, row, col) {
        if (gameOver) return;
        /* In 1-panel mode, the single panel controls all colors */
        if (numPanels > 1) {
          /* Map panel to its color index */
          if (panelIdx !== currentColor) return; /* not your turn */
        }
        if (board[row][col] !== -1) return; /* occupied */

        board[row][col] = currentColor;
        const placedColor = currentColor;

        const winCells = findWin(row, col, placedColor);
        if (winCells) {
          gameOver = true;
          _c._gameover = true;
          broadcast('boardUpdate', { board, lastMove: [row, col], winCells });
          setTimeout(() => broadcast('gameOver', { winner: placedColor, winCells }), 400);
          return;
        }

        /* Check draw */
        const full = board.every(r => r.every(c => c !== -1));
        if (full) {
          gameOver = true;
          _c._gameover = true;
          broadcast('boardUpdate', { board, lastMove: [row, col], winCells: null });
          setTimeout(() => broadcast('gameOver', { winner: -1, winCells: null }), 400);
          return;
        }

        currentColor = (currentColor + 1) % numColors;
        broadcast('boardUpdate', { board, lastMove: [row, col], winCells: null });
        broadcast('turnChange', { color: currentColor });
      },

      destroy() { panels = []; },
    };
    return _c;
  }

  /* ── init() ──────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, onGameOver } = options || {};
    const totalPlayers = window._gameSettings?.playerCount || 1;

    if (!window._GomokuCoord || window._GomokuCoord._gameover) {
      window._GomokuCoord?.destroy();
      window._GomokuCoord = createCoordinator(totalPlayers);
    }
    const coord = window._GomokuCoord;
    const numColors = coord.numColors;

    /* Which color(s) does this panel own?
       1-player: panel 0 owns all colors, but coord handles turn cycling
       2/4-player: panel owns exactly the color at its index             */
    const myColor = totalPlayers === 1 ? -1 : playerIndex; /* -1 = owns all (1p mode) */

    let dead = false;
    let winCells = null;

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#f7f3ee;position:relative;';

    /* Canvas wrapper */
    const canvasWrap = el('div', {
      style: 'flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:6px;',
    });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'touch-action:none;cursor:pointer;border-radius:6px;';
    canvasWrap.appendChild(canvas);

    /* Bottom lightbox bar */
    const bottomBar = el('div', {
      style: 'flex-shrink:0;display:flex;gap:0;border-top:2px solid #ddd;background:#fff;',
    });

    container.append(canvasWrap, bottomBar);

    /* Build lightbox cells for each color */
    const lightboxCells = [];
    for (let i = 0; i < numColors; i++) {
      const sc = STONE_COLORS[i];
      const cell = el('div', {
        style: `flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
                padding:8px 4px 6px;gap:4px;transition:background 0.2s;
                ${i > 0 ? 'border-left:1px solid #ddd;' : ''}`,
      });
      const dot = el('div', {
        style: `width:20px;height:20px;border-radius:50%;
                background:${sc.fill};border:2px solid ${sc.border};
                transition:box-shadow 0.2s, transform 0.2s;`,
      });
      const lbl = el('div', {
        style: 'font-size:0.65rem;color:#888;font-weight:bold;letter-spacing:1px;',
        text: sc.name,
      });
      cell.append(dot, lbl);
      bottomBar.append(cell);
      lightboxCells.push({ cell, dot });
    }

    /* ── Canvas drawing ───────────────────────────────────────── */
    const DPR = window.devicePixelRatio || 1;
    let cellSize = 0;

    function resizeCanvas() {
      const w = canvasWrap.clientWidth  - 12;
      const h = canvasWrap.clientHeight - 12;
      const size = Math.floor(Math.min(w, h));
      cellSize = size / BOARD_SIZE;
      canvas.width  = size * DPR;
      canvas.height = size * DPR;
      canvas.style.width  = size + 'px';
      canvas.style.height = size + 'px';
      drawBoard();
    }

    let _lastMove = null, _winCells = null, _board = coord.getBoard();

    function drawBoard() {
      const ctx = canvas.getContext('2d');
      const sz  = canvas.width; /* physical pixels */
      const cs  = cellSize * DPR;
      ctx.clearRect(0, 0, sz, sz);

      /* Board background */
      ctx.fillStyle = '#dcb483';
      ctx.fillRect(0, 0, sz, sz);

      /* Grid */
      ctx.strokeStyle = '#8b6a3a';
      ctx.lineWidth   = DPR;
      for (let i = 0; i < BOARD_SIZE; i++) {
        const x = (i + 0.5) * cs;
        ctx.beginPath(); ctx.moveTo(x, 0.5 * cs); ctx.lineTo(x, (BOARD_SIZE - 0.5) * cs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.5 * cs, x); ctx.lineTo((BOARD_SIZE - 0.5) * cs, x); ctx.stroke();
      }

      /* Star points (天元 + 4 corners) */
      const stars = [[3,3],[3,11],[7,7],[11,3],[11,11]];
      ctx.fillStyle = '#8b6a3a';
      for (const [r, c] of stars) {
        ctx.beginPath();
        ctx.arc((c + 0.5) * cs, (r + 0.5) * cs, cs * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Stones */
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const v = _board[r][c];
          if (v === -1) continue;
          const sc = STONE_COLORS[v];
          const cx = (c + 0.5) * cs, cy = (r + 0.5) * cs, rad = cs * 0.43;

          /* Winning cell highlight */
          if (_winCells) {
            const isWin = _winCells.some(([wr, wc]) => wr === r && wc === c);
            if (isWin) {
              ctx.save();
              ctx.fillStyle = 'rgba(255,220,0,0.5)';
              ctx.beginPath(); ctx.arc(cx, cy, rad * 1.3, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
            }
          }

          ctx.fillStyle = sc.fill;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = sc.border;
          ctx.lineWidth   = DPR * 1.5;
          ctx.stroke();
        }
      }

      /* Last move dot */
      if (_lastMove) {
        const [lr, lc] = _lastMove;
        const v = _board[lr][lc];
        if (v !== -1) {
          const sc = STONE_COLORS[v];
          const cx = (lc + 0.5) * cs, cy = (lr + 0.5) * cs;
          ctx.fillStyle = sc.label;
          ctx.beginPath(); ctx.arc(cx, cy, cs * 0.1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    /* ── Tap to place stone ───────────────────────────────────── */
    function onCanvasTap(e) {
      if (dead) return;
      e.preventDefault();
      const currentColor = coord.getCurrentColor();
      /* Check if this panel is allowed to place */
      if (totalPlayers > 1 && myColor !== currentColor) return;
      if (coord._gameover) return;

      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const col = Math.floor(relX / cellSize);
      const row = Math.floor(relY / cellSize);
      if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return;
      coord.place(playerIndex, row, col);
    }

    canvas.addEventListener('click', onCanvasTap);
    canvas.addEventListener('touchend', onCanvasTap, { passive: false });

    /* ── Lightbox helpers ─────────────────────────────────────── */
    function setActiveLightbox(activeColor) {
      for (let i = 0; i < numColors; i++) {
        const { cell, dot } = lightboxCells[i];
        const sc = STONE_COLORS[i];
        if (i === activeColor) {
          cell.style.background = sc.fill + '22';
          dot.style.boxShadow   = `0 0 14px 4px ${sc.fill}99`;
          dot.style.transform   = 'scale(1.3)';
        } else {
          cell.style.background = '';
          dot.style.boxShadow   = 'none';
          dot.style.transform   = 'scale(1)';
        }
      }
    }

    /* ── Coordinator callbacks ────────────────────────────────── */
    coord.register(playerIndex, {
      boardUpdate({ board, lastMove, winCells: wc }) {
        _board    = board;
        _lastMove = lastMove;
        _winCells = wc;
        drawBoard();
      },

      turnChange({ color }) {
        setActiveLightbox(color);
        /* For 1-player mode, indicate whose turn via canvas cursor */
        if (totalPlayers === 1) {
          const sc = STONE_COLORS[color];
          canvas.style.cursor = 'pointer';
          /* Show turn label overlay briefly — handled by lightbox */
        }
      },

      gameOver({ winner, winCells: wc }) {
        _winCells = wc;
        drawBoard();

        /* Dim all lightboxes */
        for (const { cell, dot } of lightboxCells) {
          cell.style.background = '';
          dot.style.boxShadow   = 'none';
          dot.style.transform   = 'scale(1)';
        }

        const overlay = el('div', {
          style: `position:absolute;inset:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;text-align:center;
                  background:rgba(255,253,248,0.95);backdrop-filter:blur(4px);padding:20px;`,
        });

        if (winner === -1) {
          overlay.innerHTML = `
            <div style="font-size:2.5rem;">🤝</div>
            <div style="font-size:1.1rem;font-weight:bold;color:#1a1a2e;margin-top:12px;">무승부!</div>
            <div style="font-size:0.85rem;color:#888;margin-top:6px;">모든 칸이 채워졌어요</div>
          `;
        } else {
          const sc = STONE_COLORS[winner];
          overlay.innerHTML = `
            <div style="font-size:2.5rem;">🏆</div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:8px;justify-content:center;">
              <div style="width:28px;height:28px;border-radius:50%;background:${sc.fill};border:2px solid ${sc.border};"></div>
              <div style="font-size:1.2rem;font-weight:bold;color:#1a1a2e;">${sc.name} 승리!</div>
            </div>
            <div style="font-size:0.85rem;color:#888;margin-top:6px;">5목 완성!</div>
          `;
        }
        container.appendChild(overlay);
        if (onGameOver) onGameOver(winner === playerIndex ? 1 : 0);
      },
    });

    /* ── ResizeObserver for responsive canvas ─────────────────── */
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvasWrap);

    function destroy() {
      dead = true;
      ro.disconnect();
      container.innerHTML = '';
    }
    return { destroy };
  }

  function el(tag, { style, text } = {}) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text)  e.textContent = text;
    return e;
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['gomoku'] = { init };
})();
