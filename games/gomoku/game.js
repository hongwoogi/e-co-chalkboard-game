'use strict';
/**
 * games/gomoku/game.js  — 오목
 *
 * Players: 1 (solo, alternates 흑/백) | 2 (흑 vs 백) | 4 (P1&P3 흑 vs P2&P4 백)
 * 3-player is not supported.
 * Single shared screen. Background color changes every turn to show whose turn it is.
 */
(function registerGomoku() {

  const BOARD_SIZE = 15;

  /* Two stone colors only ---------------------------------------- */
  const STONES = [
    { name: '흑', fill: '#1e1e1e', border: '#555',    label: '#ffffff' },
    { name: '백', fill: '#f5ede0', border: '#bbbbbb', label: '#333333' },
  ];

  /* Turn descriptors per player-count ----------------------------- */
  function buildTurns(n) {
    /* Each entry: { tag, stone(0=흑|1=백), bg, fg } */
    if (n === 1) return [
      { tag: '흑',    stone: 0, bg: '#27231f', fg: '#f5ede0' },
      { tag: '백',    stone: 1, bg: '#fdf7ef', fg: '#2a2522' },
    ];
    if (n === 2) return [
      { tag: '1P 흑', stone: 0, bg: '#27231f', fg: '#f5ede0' },
      { tag: '2P 백', stone: 1, bg: '#fdf7ef', fg: '#2a2522' },
    ];
    /* 4-player: P1&P3 = 흑 team, P2&P4 = 백 team */
    return [
      { tag: '1P 흑', stone: 0, bg: '#1e1e1e', fg: '#f0e8dc' },
      { tag: '2P 백', stone: 1, bg: '#fdf7ef', fg: '#222222' },
      { tag: '3P 흑', stone: 0, bg: '#182030', fg: '#d8eaff' },
      { tag: '4P 백', stone: 1, bg: '#fff5ea', fg: '#2a1a08' },
    ];
  }

  /* Win detection ------------------------------------------------- */
  function findWin(board, row, col, stoneColor) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      const cells = [[row, col]];
      for (let s = 1; s <= 4; s++) {
        const nr = row + dr*s, nc = col + dc*s;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr][nc] === stoneColor) cells.push([nr, nc]); else break;
      }
      for (let s = 1; s <= 4; s++) {
        const nr = row - dr*s, nc = col - dc*s;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (board[nr][nc] === stoneColor) cells.push([nr, nc]); else break;
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  /* ── init() ───────────────────────────────────────────────────── */
  function init(container, options) {
    const { onGameOver } = options || {};
    let n = window._gameSettings?.playerCount || 2;
    if (n === 3) n = 2; /* 3-player unsupported → 2-player */
    n = Math.min(n, 4);

    const turns = buildTurns(n);
    let turnIdx  = 0;
    let dead     = false;
    let gameOver = false;
    let lastMove = null;
    let winCells = null;

    const board = Array.from({ length: BOARD_SIZE }, () => new Array(BOARD_SIZE).fill(-1));

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText =
      'display:flex;flex-direction:column;height:100%;overflow:hidden;' +
      'position:relative;transition:background 0.3s;';

    /* Canvas wrapper */
    const canvasWrap = el('div', {
      style: 'flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:8px;',
    });
    const canvas = el('canvas', { style: 'touch-action:none;cursor:pointer;border-radius:8px;' });
    canvasWrap.appendChild(canvas);

    /* Bottom turn bar */
    const bottomBar = el('div', {
      style: 'flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
             'gap:10px;padding:10px 14px;transition:background 0.3s;border-top:2px solid rgba(0,0,0,0.12);',
    });
    const stoneDot = el('div', {
      style: 'width:22px;height:22px;border-radius:50%;flex-shrink:0;transition:background 0.3s,border-color 0.3s;',
    });
    const turnLabel = el('div', {
      style: 'font-size:1rem;font-weight:bold;letter-spacing:1px;transition:color 0.3s;',
    });
    const turnSub = el('div', {
      style: 'font-size:0.75rem;opacity:0.65;transition:color 0.3s;',
    });
    const labelWrap = el('div', { style: 'display:flex;flex-direction:column;gap:2px;' });
    labelWrap.append(turnLabel, turnSub);
    bottomBar.append(stoneDot, labelWrap);
    container.append(canvasWrap, bottomBar);

    /* ── Canvas ──────────────────────────────────────────────── */
    const DPR = window.devicePixelRatio || 1;
    let cellSize = 0;

    function resizeCanvas() {
      const w = canvasWrap.clientWidth  - 16;
      const h = canvasWrap.clientHeight - 16;
      const size = Math.floor(Math.min(w, h));
      cellSize = size / BOARD_SIZE;
      canvas.width  = size * DPR;
      canvas.height = size * DPR;
      canvas.style.width  = size + 'px';
      canvas.style.height = size + 'px';
      drawBoard();
    }

    function drawBoard() {
      const ctx = canvas.getContext('2d');
      const sz  = canvas.width;
      const cs  = cellSize * DPR;

      ctx.clearRect(0, 0, sz, sz);

      /* Wooden board */
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

      /* Star points */
      ctx.fillStyle = '#8b6a3a';
      for (const [r, c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]) {
        ctx.beginPath();
        ctx.arc((c + 0.5) * cs, (r + 0.5) * cs, cs * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Stones */
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const v = board[r][c];
          if (v === -1) continue;
          const st = STONES[v];
          const cx = (c + 0.5) * cs, cy = (r + 0.5) * cs, rad = cs * 0.43;

          if (winCells?.some(([wr, wc]) => wr === r && wc === c)) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,220,0,0.55)';
            ctx.beginPath(); ctx.arc(cx, cy, rad * 1.35, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }

          ctx.fillStyle = st.fill;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = st.border;
          ctx.lineWidth   = DPR * 1.5;
          ctx.stroke();
        }
      }

      /* Last-move dot */
      if (lastMove) {
        const [lr, lc] = lastMove;
        const v = board[lr][lc];
        if (v !== -1) {
          ctx.fillStyle = STONES[v].label;
          const cx = (lc + 0.5) * cs, cy = (lr + 0.5) * cs;
          ctx.beginPath(); ctx.arc(cx, cy, cs * 0.1, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    /* ── Turn UI ─────────────────────────────────────────────── */
    function applyTurnUI() {
      const t  = turns[turnIdx];
      const st = STONES[t.stone];

      container.style.background = t.bg;
      bottomBar.style.background = 'rgba(0,0,0,0.18)';
      turnLabel.style.color      = t.fg;
      turnLabel.textContent      = t.tag + ' 차례';
      turnSub.style.color        = t.fg;
      turnSub.textContent        = n === 4
        ? (t.stone === 0 ? '흑 팀 (1P · 3P)' : '백 팀 (2P · 4P)')
        : '';

      stoneDot.style.background   = st.fill;
      stoneDot.style.border       = `2px solid ${st.border}`;
      stoneDot.style.boxShadow    = `0 0 10px 3px ${st.fill}99`;
    }

    applyTurnUI();

    /* ── Tap to place stone ──────────────────────────────────── */
    function onTap(e) {
      if (dead || gameOver) return;
      e.preventDefault();

      const rect   = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const col = Math.floor((clientX - rect.left)  / cellSize);
      const row = Math.floor((clientY - rect.top)   / cellSize);
      if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return;
      if (board[row][col] !== -1) return;

      const t = turns[turnIdx];
      board[row][col] = t.stone;
      lastMove = [row, col];

      const wc = findWin(board, row, col, t.stone);
      if (wc) {
        winCells = wc;
        gameOver = true;
        drawBoard();
        showWinOverlay(t, wc);
        if (onGameOver) onGameOver(0);
        return;
      }

      if (board.every(r => r.every(c => c !== -1))) {
        gameOver = true;
        drawBoard();
        showDrawOverlay();
        if (onGameOver) onGameOver(0);
        return;
      }

      turnIdx = (turnIdx + 1) % turns.length;
      drawBoard();
      applyTurnUI();
    }

    canvas.addEventListener('click',    onTap);
    canvas.addEventListener('touchend', onTap, { passive: false });

    /* ── Overlays ────────────────────────────────────────────── */
    function showWinOverlay(t, wc) {
      const st = STONES[t.stone];
      const teamLabel = n === 4
        ? ` (${t.stone === 0 ? '흑 팀' : '백 팀'} 승리!)`
        : '';
      const overlay = el('div', {
        style: 'position:absolute;inset:0;display:flex;flex-direction:column;' +
               'align-items:center;justify-content:center;text-align:center;' +
               'background:rgba(255,253,248,0.95);backdrop-filter:blur(4px);padding:24px;',
      });
      overlay.innerHTML = `
        <div style="font-size:2.8rem;">🏆</div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:10px;justify-content:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:${st.fill};border:2px solid ${st.border};"></div>
          <div style="font-size:1.3rem;font-weight:bold;color:#1a1a2e;">${t.tag}${teamLabel}</div>
        </div>
        <div style="font-size:0.9rem;color:#888;margin-top:8px;">5목 완성!</div>
      `;
      container.appendChild(overlay);
    }

    function showDrawOverlay() {
      const overlay = el('div', {
        style: 'position:absolute;inset:0;display:flex;flex-direction:column;' +
               'align-items:center;justify-content:center;text-align:center;' +
               'background:rgba(255,253,248,0.95);backdrop-filter:blur(4px);padding:24px;',
      });
      overlay.innerHTML = `
        <div style="font-size:2.8rem;">🤝</div>
        <div style="font-size:1.2rem;font-weight:bold;color:#1a1a2e;margin-top:14px;">무승부!</div>
        <div style="font-size:0.9rem;color:#888;margin-top:8px;">모든 칸이 채워졌어요</div>
      `;
      container.appendChild(overlay);
    }

    /* ── ResizeObserver ──────────────────────────────────────── */
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
