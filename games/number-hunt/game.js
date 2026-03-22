'use strict';
/**
 * games/number-hunt/game.js
 * "숫자 빨리 찾기" — Number Hunt mini-game
 *
 * A grid of shuffled numbers appears.
 * Tap them in ascending order as fast as possible!
 *
 * Grid sizes by difficulty:
 *   Easy:   5×5 = 25 numbers
 *   Medium: 6×6 = 36 numbers
 *   Hard:   7×7 = 49 numbers
 *
 * Score = numbers found × 10
 * Completing the whole grid gives a time bonus.
 */

(function registerNumberHunt() {

  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score       = 0;
    let timeLeft    = gameDuration;
    let isGameOver  = false;
    let nextTarget  = 1;
    let totalNums   = 0;
    let gridSize    = 5;   // 5, 6, or 7
    let timerHandle = null;
    let cells       = [];  // array of { num, el, found }

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
      <div class="score-chip"><span class="score-icon">🔍</span><span id="nh-score-${playerIndex}">0</span>점</div>
      <div id="nh-target-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};"></div>
      <div style="display:flex;align-items:center;gap:var(--space-xs);">
        <span>⏱</span>
        <div class="timer-digit" id="nh-timer-${playerIndex}">${gameDuration}</div>
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

    /* Grid area */
    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-sm);
      min-height: 0;
      overflow: hidden;
    `;

    const gridEl = document.createElement('div');
    gridEl.id = `nh-grid-${playerIndex}`;
    gridWrap.appendChild(gridEl);

    container.appendChild(topBar);
    container.appendChild(timerBarWrap);
    container.appendChild(gridWrap);

    /* ── DOM refs ── */
    const scoreEl    = container.querySelector(`#nh-score-${playerIndex}`);
    const timerDigit = container.querySelector(`#nh-timer-${playerIndex}`);
    const targetEl   = container.querySelector(`#nh-target-${playerIndex}`);

    /* ── Difficulty selection overlay ── */
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
        <div style="font-family:var(--font-display);font-size:var(--text-xl);color:${playerColor};">🔍 난이도 선택</div>
      `;
      const diffs = [
        { label: '쉬움', sub: '5×5 (25개)', size: 5 },
        { label: '보통', sub: '6×6 (36개)', size: 6 },
        { label: '어려움', sub: '7×7 (49개)', size: 7 },
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
        btn.addEventListener('click', () => {
          overlay.remove();
          startGame(d.size);
        });
        btn.addEventListener('touchend', e => { e.preventDefault(); overlay.remove(); startGame(d.size); }, { passive: false });
        overlay.appendChild(btn);
      });
      container.appendChild(overlay);
    }

    /* ── Build grid ── */
    function buildGrid(size) {
      gridSize  = size;
      totalNums = size * size;
      cells     = [];

      // Shuffle numbers 1..totalNums
      const nums = Array.from({ length: totalNums }, (_, i) => i + 1);
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
      }

      gridEl.style.cssText = `
        display: grid;
        grid-template-columns: repeat(${size}, 1fr);
        gap: clamp(3px, 1vmin, 8px);
        width: min(100%, calc(100vh * 0.6));
        max-width: 500px;
      `;
      gridEl.innerHTML = '';

      nums.forEach(num => {
        const el = document.createElement('div');
        el.style.cssText = `
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: clamp(4px, 1vmin, 10px);
          background: var(--surface-container-high);
          border: 2px solid var(--outline-variant);
          font-family: var(--font-display);
          font-size: clamp(0.9rem, 3vmin, 2rem);
          color: var(--on-surface);
          cursor: pointer;
          user-select: none;
          touch-action: manipulation;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;
        `;
        el.textContent = num;

        const cell = { num, el, found: false };
        cells.push(cell);

        const onTap = (e) => {
          e.preventDefault();
          if (isGameOver || cell.found) return;
          if (num === nextTarget) {
            // Correct!
            cell.found = true;
            el.style.background   = playerColor.startsWith('var') ? 'var(--primary)' : playerColor;
            el.style.borderColor  = 'transparent';
            el.style.color        = '#fff';
            el.style.transform    = 'scale(1.15)';
            setTimeout(() => { el.style.transform = ''; }, 200);

            score += 10;
        window.SoundEngine?.play("correct");
            nextTarget++;
            updateHUD();

            if (nextTarget > totalNums) {
              // All found — time bonus
              const bonus = timeLeft * 5;
              score += bonus;
              updateHUD();
              endGame(true);
            }
          } else {
            // Wrong — flash red
            el.style.background = '#ef5350';
            el.style.borderColor = '#ef5350';
            setTimeout(() => {
              el.style.background  = '';
              el.style.borderColor = '';
            }, 400);
          }
        };

        el.addEventListener('click', onTap);
        el.addEventListener('touchend', onTap, { passive: false });
        gridEl.appendChild(el);
      });
    }

    /* ── HUD ── */
    function updateHUD() {
      if (scoreEl)    scoreEl.textContent = score;
      if (targetEl)   targetEl.textContent = isGameOver ? '' : `▶ ${nextTarget}`;
      if (timerDigit) timerDigit.textContent = timeLeft;
      if (timerBarFill) timerBarFill.style.width = `${(timeLeft / gameDuration) * 100}%`;
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
    function startGame(size) {
      score      = 0;
      nextTarget = 1;
      isGameOver = false;
      timeLeft   = gameDuration;
      buildGrid(size);
      updateHUD();
      startTimer();
    }

    /* ── End ── */
    function endGame(completed) {
      isGameOver = true;
      clearInterval(timerHandle);

      const key  = `number-hunt-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = completed ? '🏆' : score >= 200 ? '🥈' : '🔍';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${nextTarget - 1}/${totalNums} 찾음</div>
        ${completed ? `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--primary);">완주 보너스 +${(score - (nextTarget - 1) * 10)}점 🎉</div>` : ''}
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
    }

    // Use preset difficulty if chosen from panel picker, else show selector
    const preset = window._gameSettings && window._gameSettings.difficulties && window._gameSettings.difficulties['number-hunt'];
    if (preset) {
      startGame(preset.size);
    } else {
      showDifficultySelect();
    }
    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['number-hunt'] = { init };

})();
