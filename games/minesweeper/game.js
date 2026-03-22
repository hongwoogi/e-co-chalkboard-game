'use strict';
/**
 * games/minesweeper/game.js
 * "지뢰찾기" — Minesweeper mini-game
 *
 * Tap to reveal a cell.
 * Long-press (500ms) to toggle a flag.
 * Flood-fill reveals empty areas automatically.
 *
 * Score = revealed safe cells × 10
 * Hitting a mine ends the game immediately.
 * Revealing all safe cells wins the round.
 *
 * Difficulty:
 *   Easy:   9×9,  10 mines
 *   Medium: 12×12, 20 mines
 *   Hard:   16×16, 40 mines
 */

(function registerMinesweeper() {

  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score      = 0;
    let timeLeft   = gameDuration;
    let isGameOver = false;
    let timerHandle = null;
    let rows, cols, mineCount;
    let board = [];   // board[r][c] = { mine, adj, revealed, flagged, el }
    let firstTap = true;
    let flagMode = false; // when true, tap = flag instead of reveal

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
      background: var(--surface-container-low);
    `;

    /* Top bar */
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-xs) var(--space-sm);
      background: var(--surface-container);
      flex-shrink: 0;
      gap: var(--space-sm);
    `;
    topBar.innerHTML = `
      <div class="score-chip"><span class="score-icon">💣</span><span id="ms-score-${playerIndex}">0</span>점</div>
      <div id="ms-flags-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#ef5350;">🚩 0</div>
      <div style="display:flex;align-items:center;gap:var(--space-xs);">
        <span>⏱</span>
        <div class="timer-digit" id="ms-timer-${playerIndex}">${gameDuration}</div>
      </div>
    `;

    /* Timer bar */
    const timerBarWrap = document.createElement('div');
    timerBarWrap.className = 'timer-bar-wrapper';
    timerBarWrap.style.flexShrink = '0';
    const timerBarFill = document.createElement('div');
    timerBarFill.className = 'timer-bar-fill';
    timerBarFill.style.width = '100%';
    timerBarWrap.appendChild(timerBarFill);

    /* Instruction */
    const instrEl = document.createElement('div');
    instrEl.style.cssText = `
      text-align: center;
      font-size: var(--text-xs);
      color: var(--on-surface-variant);
      padding: 2px var(--space-sm);
      flex-shrink: 0;
      font-family: var(--font-body);
    `;
    instrEl.innerHTML = '';
    instrEl.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6em;
      font-size: var(--text-xs);
      color: var(--on-surface-variant);
      padding: 2px var(--space-sm);
      flex-shrink: 0;
      font-family: var(--font-body);
    `;
    const modeRevealBtn = document.createElement('button');
    modeRevealBtn.id = `ms-mode-reveal-${playerIndex}`;
    modeRevealBtn.textContent = '👆 선택';
    modeRevealBtn.style.cssText = `
      padding: 0.25em 0.7em;
      border-radius: 2em;
      border: 2px solid ${playerColor};
      background: ${playerColor};
      color: #fff;
      font-size: var(--text-xs);
      cursor: pointer;
      touch-action: manipulation;
      font-family: var(--font-body);
      transition: background 0.15s, color 0.15s;
    `;
    const modeFlagBtn = document.createElement('button');
    modeFlagBtn.id = `ms-mode-flag-${playerIndex}`;
    modeFlagBtn.textContent = '🚩 깃발';
    modeFlagBtn.style.cssText = `
      padding: 0.25em 0.7em;
      border-radius: 2em;
      border: 2px solid rgba(239,83,80,0.5);
      background: transparent;
      color: var(--on-surface-variant);
      font-size: var(--text-xs);
      cursor: pointer;
      touch-action: manipulation;
      font-family: var(--font-body);
      transition: background 0.15s, color 0.15s;
    `;
    function updateModeButtons() {
      if (flagMode) {
        modeRevealBtn.style.background = 'transparent';
        modeRevealBtn.style.color = 'var(--on-surface-variant)';
        modeRevealBtn.style.borderColor = 'rgba(255,255,255,0.2)';
        modeFlagBtn.style.background = '#ef5350';
        modeFlagBtn.style.color = '#fff';
        modeFlagBtn.style.borderColor = '#ef5350';
      } else {
        modeRevealBtn.style.background = playerColor;
        modeRevealBtn.style.color = '#fff';
        modeRevealBtn.style.borderColor = playerColor;
        modeFlagBtn.style.background = 'transparent';
        modeFlagBtn.style.color = 'var(--on-surface-variant)';
        modeFlagBtn.style.borderColor = 'rgba(239,83,80,0.5)';
      }
    }
    const setReveal = (e) => { e && e.preventDefault(); flagMode = false; updateModeButtons(); };
    const setFlag   = (e) => { e && e.preventDefault(); flagMode = true;  updateModeButtons(); };
    modeRevealBtn.addEventListener('click', setReveal);
    modeRevealBtn.addEventListener('touchend', setReveal, { passive: false });
    modeFlagBtn.addEventListener('click', setFlag);
    modeFlagBtn.addEventListener('touchend', setFlag, { passive: false });
    instrEl.appendChild(modeRevealBtn);
    instrEl.appendChild(modeFlagBtn);

    /* Grid area */
    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-xs);
      min-height: 0;
      overflow: hidden;
    `;

    const gridEl = document.createElement('div');
    gridEl.id = `ms-grid-${playerIndex}`;
    gridWrap.appendChild(gridEl);

    container.appendChild(topBar);
    container.appendChild(timerBarWrap);
    container.appendChild(instrEl);
    container.appendChild(gridWrap);

    /* ── DOM refs ── */
    const scoreEl    = container.querySelector(`#ms-score-${playerIndex}`);
    const timerDigit = container.querySelector(`#ms-timer-${playerIndex}`);
    const flagsEl    = container.querySelector(`#ms-flags-${playerIndex}`);

    /* ── Difficulty selection ── */
    function showDifficultySelect() {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-md);
        background: var(--surface-container-low);
        z-index: 20;
        padding: var(--space-md);
      `;
      overlay.innerHTML = `
        <div style="font-family:var(--font-display);font-size:var(--text-xl);color:${playerColor};">💣 난이도 선택</div>
      `;
      const diffs = [
        { label: '쉬움',   sub: '9×9, 지뢰 10개',    r: 9,  c: 9,  m: 10 },
        { label: '보통',   sub: '12×12, 지뢰 20개',  r: 12, c: 12, m: 20 },
        { label: '어려움', sub: '16×16, 지뢰 40개',  r: 16, c: 16, m: 40 },
      ];
      diffs.forEach(d => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          width: 80%;
          max-width: 260px;
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-lg);
          border: 2px solid ${playerColor};
          background: transparent;
          color: var(--on-surface);
          font-family: var(--font-display);
          font-size: var(--text-lg);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          transition: background 0.2s;
        `;
        btn.innerHTML = `<span>${d.label}</span><span style="font-size:var(--text-sm);color:var(--on-surface-variant);font-family:var(--font-body);">${d.sub}</span>`;
        const go = () => { overlay.remove(); startGame(d.r, d.c, d.m); };
        btn.addEventListener('click', go);
        btn.addEventListener('touchend', e => { e.preventDefault(); go(); }, { passive: false });
        overlay.appendChild(btn);
      });
      container.appendChild(overlay);
    }

    /* ── Build board ── */
    function buildBoard(r, c, m) {
      rows = r; cols = c; mineCount = m;
      board = [];
      firstTap = true;

      // Cell size based on available space
      const availW = gridWrap.clientWidth  || 300;
      const availH = gridWrap.clientHeight || 400;
      const cellPx = Math.max(18, Math.min(Math.floor(availW / cols), Math.floor(availH / rows), 40));

      gridEl.style.cssText = `
        display: grid;
        grid-template-columns: repeat(${cols}, ${cellPx}px);
        grid-template-rows: repeat(${rows}, ${cellPx}px);
        gap: 2px;
      `;
      gridEl.innerHTML = '';

      for (let ri = 0; ri < rows; ri++) {
        board[ri] = [];
        for (let ci = 0; ci < cols; ci++) {
          const el = document.createElement('div');
          el.style.cssText = `
            width: ${cellPx}px;
            height: ${cellPx}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
            background: var(--surface-container-high);
            border: 1px solid var(--outline-variant);
            font-family: var(--font-display);
            font-size: ${cellPx * 0.52}px;
            cursor: pointer;
            user-select: none;
            touch-action: none;
            transition: background 0.1s;
          `;
          const cell = { mine: false, adj: 0, revealed: false, flagged: false, el, r: ri, c: ci };
          board[ri][ci] = cell;
          attachHandlers(cell);
          gridEl.appendChild(el);
        }
      }
    }

    /* ── Place mines (after first tap, avoiding first cell) ── */
    function placeMines(safeR, safeC) {
      const candidates = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (!(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1))
            candidates.push([r, c]);

      // Shuffle
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      const placed = Math.min(mineCount, candidates.length);
      for (let i = 0; i < placed; i++) {
        const [r, c] = candidates[i];
        board[r][c].mine = true;
      }

      // Compute adjacency
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (board[r][c].mine) continue;
          let adj = 0;
          forNeighbors(r, c, (nr, nc) => { if (board[nr][nc].mine) adj++; });
          board[r][c].adj = adj;
        }
    }

    /* ── Neighbors helper ── */
    function forNeighbors(r, c, fn) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
        }
    }

    /* ── Reveal cell (flood fill) ── */
    function reveal(r, c) {
      const cell = board[r][c];
      if (cell.revealed || cell.flagged) return;
      cell.revealed = true;

      if (cell.mine) {
        // Boom!
        showMine(cell);
        explodeAll();
        endGame(false);
        return;
      }

      score += 10;
        window.SoundEngine?.play("correct");
      renderRevealed(cell);

      if (cell.adj === 0) {
        // Flood fill
        forNeighbors(r, c, (nr, nc) => reveal(nr, nc));
      }

      // Check win
      const safe   = rows * cols - mineCount;
      const found  = board.flat().filter(cl => cl.revealed).length;
      if (found >= safe) endGame(true);

      updateHUD();
    }

    /* ── Render helpers ── */
    const ADJ_COLORS = ['', '#1565c0','#2e7d32','#c62828','#6a1b9a','#bf360c','#00695c','#212121','#546e7a'];

    function renderRevealed(cell) {
      const el = cell.el;
      el.style.background  = 'var(--surface-container)';
      el.style.borderColor = 'var(--outline-variant)';
      el.style.color       = ADJ_COLORS[cell.adj] || '#888';
      el.textContent       = cell.adj > 0 ? cell.adj : '';
    }

    function showMine(cell) {
      cell.el.style.background = '#ef5350';
      cell.el.textContent      = '💥';
    }

    function explodeAll() {
      board.flat().forEach(cell => {
        if (cell.mine && !cell.revealed) {
          cell.revealed = true;
          cell.el.style.background = '#b71c1c';
          cell.el.textContent      = '💣';
        }
      });
    }

    /* ── Long-press flag handler ── */
    function attachHandlers(cell) {
      let pressTimer = null;
      let didFlag    = false;

      const onStart = (e) => {
        e.preventDefault();
        didFlag = false;
        pressTimer = setTimeout(() => {
          didFlag = true;
          toggleFlag(cell);
        }, 500);
      };

      const onEnd = (e) => {
        e.preventDefault();
        clearTimeout(pressTimer);
        if (!didFlag) {
          if (isGameOver) return;
          if (flagMode) {
            // Flag mode: tap = toggle flag
            if (!cell.revealed) toggleFlag(cell);
            return;
          }
          if (cell.flagged || cell.revealed) return;
          if (firstTap) {
            firstTap = false;
            placeMines(cell.r, cell.c);
            startTimer();
          }
          reveal(cell.r, cell.c);
        }
      };

      const onCancel = () => {
        clearTimeout(pressTimer);
        didFlag = false;
      };

      cell.el.addEventListener('touchstart',  onStart,  { passive: false });
      cell.el.addEventListener('touchend',    onEnd,    { passive: false });
      cell.el.addEventListener('touchcancel', onCancel);
      cell.el.addEventListener('mousedown',   onStart);
      cell.el.addEventListener('mouseup',     onEnd);
      cell.el.addEventListener('mouseleave',  onCancel);
      // Prevent context menu on long press
      cell.el.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(cell); });
    }

    function toggleFlag(cell) {
      if (cell.revealed || isGameOver) return;
      cell.flagged = !cell.flagged;
      cell.el.textContent = cell.flagged ? '🚩' : '';
      cell.el.style.background = cell.flagged ? 'rgba(239,83,80,0.2)' : '';
      updateHUD();
    }

    /* ── HUD ── */
    function updateHUD() {
      if (scoreEl)    scoreEl.textContent = score;
      if (timerDigit) timerDigit.textContent = timeLeft;
      if (timerBarFill) timerBarFill.style.width = `${(timeLeft / gameDuration) * 100}%`;
      const flagged = board.flat().filter(c => c.flagged).length;
      if (flagsEl)    flagsEl.textContent = `🚩 ${flagged} / ${mineCount}`;
      const urgent = timeLeft <= 10;
      if (timerDigit)  timerDigit.classList.toggle('urgent', urgent);
      if (timerBarFill) timerBarFill.classList.toggle('urgent', urgent);
    }

    /* ── Timer ── */
    function startTimer() {
      clearInterval(timerHandle);
      timerHandle = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) endGame(false);
      }, 1000);
    }

    /* ── Start ── */
    function startGame(r, c, m) {
      score      = 0;
      timeLeft   = gameDuration;
      isGameOver = false;
      buildBoard(r, c, m);
      updateHUD();
      // Timer starts on first tap
    }

    /* ── End ── */
    function endGame(won) {
      isGameOver = true;
      clearInterval(timerHandle);

      const key  = `minesweeper-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = won ? '🏆' : '💥';

      const revealed = board.flat().filter(c => c.revealed && !c.mine).length;

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} ${won ? '클리어!' : '게임 종료!'}</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${revealed}칸 열기 성공</div>
        ${isNewBest
          ? `<div style="font-family:var(--font-body);font-size:var(--text-md);color:var(--primary);animation:bounceIn 0.5s 0.3s both;">🌟 최고 기록!</div>`
          : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최고: ${Math.max(score, best)}점</div>`
        }
      `;
      container.appendChild(overlay);
      if (typeof onGameOver === 'function') onGameOver(score);
    }

    /* ── Destroy ── */
    function destroy() {
      isGameOver = true;
      clearInterval(timerHandle);
      if (container) container.innerHTML = '';
      board = [];
    }

    // Use preset difficulty if chosen from panel picker, else show selector
    const preset = window._gameSettings && window._gameSettings.difficulties && window._gameSettings.difficulties['minesweeper'];
    if (preset) {
      startGame(preset.rows, preset.cols, preset.mines);
    } else {
      showDifficultySelect();
    }
    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['minesweeper'] = { init };

})();
