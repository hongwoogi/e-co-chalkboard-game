'use strict';
/**
 * games/rhythm-tap/game.js
 * "리듬 탭" — Rhythm Tap mini-game
 *
 * Circles fall from the top in 3 columns.
 * A hit zone glows at the bottom.
 * Tap a circle when it overlaps the hit zone for points!
 *
 * "Perfect!" (closer to center) = +15
 * "Good!"    (within hit zone)  = +10
 * "Miss!"    (circle escapes)   = 0 (forgiving for kids)
 *
 * Speed increases over time.
 * Circles have random colors from the design palette.
 */

(function registerRhythmTap() {

  const CIRCLE_COLORS = [
    '#fdd34d',  // gold
    '#fd8863',  // coral
    '#7ed3ff',  // sky blue
    '#c084fc',  // purple
    '#4ade80',  // green
    '#f472b6',  // pink
  ];

  const POINTS_PERFECT = 15;
  const POINTS_GOOD    = 10;
  const COLUMNS        = 3;

  /* ─────────────────────────────────────────────────────
     init()
  ───────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score         = 0;
    let timeLeft      = gameDuration;
    let isGameOver    = false;
    let timerInterval = null;
    let spawnTimeout  = null;
    let animFrameId   = null;
    let elapsed       = 0;       // seconds elapsed (for speed scaling)

    // Active circles: each = { element, col, y (0–1 fraction), color, removed }
    let activeCircles = [];

    // Hit feedback labels (floating text)
    let feedbacks = [];

    /* ── DOM refs ── */
    let dom = {};

    /* ─────────────────────────────────────
       BUILD UI
    ───────────────────────────────────── */
    function buildUI() {
      container.innerHTML = '';
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        position: relative;
        background:#f7f3ee;
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
        <div class="score-chip"><span class="score-icon">🎵</span><span id="rt-score-${playerIndex}">0</span>점</div>
        <div style="display:flex;align-items:center;gap:var(--space-xs);">
          <span>⏱</span>
          <div class="timer-digit" id="rt-timer-${playerIndex}">${gameDuration}</div>
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
        padding: var(--space-xs) var(--space-sm);
        flex-shrink: 0;
        font-family: var(--font-body);
      `;
      instrEl.textContent = '빛나는 원이 아래 줄에 닿을 때 탭하세요! 🥁';

      /* Game arena: takes up all remaining space */
      const arena = document.createElement('div');
      arena.id = `rt-arena-${playerIndex}`;
      arena.style.cssText = `
        position: relative;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      `;

      /* Column dividers — visual guides */
      for (let c = 1; c < COLUMNS; c++) {
        const divider = document.createElement('div');
        divider.style.cssText = `
          position: absolute;
          top: 0; bottom: 0;
          left: ${(c / COLUMNS) * 100}%;
          width: 1px;
          background: var(--outline-variant);
          opacity: 0.3;
          pointer-events: none;
        `;
        arena.appendChild(divider);
      }

      /* Hit zone strip at bottom of arena */
      const hitZone = document.createElement('div');
      hitZone.id = `rt-hitzone-${playerIndex}`;
      hitZone.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0; right: 0;
        height: clamp(3rem, 10vh, 5rem);
        background: linear-gradient(to top, rgba(253,211,77,0.15), transparent);
        border-top: 2px solid rgba(253,211,77,0.4);
        pointer-events: none;
        z-index: 1;
      `;

      // Hit zone label
      const hitLabel = document.createElement('div');
      hitLabel.style.cssText = `
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        font-size: var(--text-xs);
        color: rgba(253,211,77,0.6);
        font-family: var(--font-display);
        pointer-events: none;
        white-space: nowrap;
      `;
      hitLabel.textContent = '▼ 여기서 탭!';
      hitZone.appendChild(hitLabel);

      arena.appendChild(hitZone);
      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(instrEl);
      container.appendChild(arena);

      /* Cache refs */
      dom.scoreEl    = container.querySelector(`#rt-score-${playerIndex}`);
      dom.timerDigit = container.querySelector(`#rt-timer-${playerIndex}`);
      dom.timerBar   = timerBarFill;
      dom.arena      = container.querySelector(`#rt-arena-${playerIndex}`);
      dom.hitZone    = container.querySelector(`#rt-hitzone-${playerIndex}`);

      startGame();
    }

    /* ─────────────────────────────────────
       GAME LOGIC
    ───────────────────────────────────── */
    function startGame() {
      score         = 0;
      timeLeft      = gameDuration;
      isGameOver    = false;
      elapsed       = 0;
      activeCircles = [];
      feedbacks     = [];

      updateScoreUI();
      updateTimerUI();

      startTimer();
      scheduleSpawn();
      requestAnimationFrame(gameLoop);
    }

    /** Speed of fall in arena-heights per second, scales with time. */
    function getFallSpeed() {
      // starts at 0.25, ramps up to 0.65 over game duration
      const t = Math.min(elapsed / gameDuration, 1);
      return 0.25 + t * 0.4;
    }

    /** Milliseconds between spawns; gets shorter over time. */
    function getSpawnInterval() {
      const t = Math.min(elapsed / gameDuration, 1);
      return Math.max(600, 1600 - t * 1000);
    }

    let lastFrameTime = null;

    function gameLoop(timestamp) {
      if (isGameOver) return;

      const dt = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
      lastFrameTime = timestamp;

      const arenaH = dom.arena.clientHeight || 400;
      const hitZoneH = dom.hitZone.clientHeight || 64;

      // Move circles down
      const toRemove = [];
      activeCircles.forEach(c => {
        if (c.removed) return;
        c.y += getFallSpeed() * dt; // fraction of arena height

        const px = c.y * arenaH;
        c.element.style.top = `${px}px`;

        // Remove if escaped past bottom
        if (px > arenaH + 20) {
          c.removed = true;
          c.element.remove();
          toRemove.push(c);
          // "Miss" feedback (no point deduction — kid-friendly)
          showFeedback('😅 Miss!', c.col, 'rgba(255,255,255,0.4)');
        }
      });

      activeCircles = activeCircles.filter(c => !c.removed);
      animFrameId = requestAnimationFrame(gameLoop);
    }

    function scheduleSpawn() {
      if (isGameOver) return;
      const delay = getSpawnInterval();
      spawnTimeout = setTimeout(() => {
        spawnCircle();
        scheduleSpawn();
      }, delay);
    }

    function spawnCircle() {
      if (isGameOver) return;

      const col    = Math.floor(Math.random() * COLUMNS);
      const color  = CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)];

      const arenaW = dom.arena.clientWidth  || 300;
      const arenaH = dom.arena.clientHeight || 400;

      const colW       = arenaW / COLUMNS;
      const circleSize = Math.min(colW * 0.65, 70);
      const centerX    = col * colW + colW / 2 - circleSize / 2;

      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        width: ${circleSize}px;
        height: ${circleSize}px;
        left: ${centerX}px;
        top: -${circleSize}px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 85%, white), ${color});
        box-shadow: 0 0 16px 4px ${color}66, inset 0 3px 6px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.2);
        cursor: pointer;
        touch-action: manipulation;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${circleSize * 0.45}px;
        user-select: none;
      `;
      el.textContent = '●';

      const circleObj = { element: el, col, y: -(circleSize / arenaH), color, removed: false };

      const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (circleObj.removed || isGameOver) return;

        // Determine timing quality
        const circleTop   = circleObj.y * arenaH;
        const hitZoneTop  = arenaH - (dom.hitZone.clientHeight || 64);
        const circleBot   = circleTop + circleSize;
        const circleCenter = circleTop + circleSize / 2;
        const hitCenter    = hitZoneTop + (dom.hitZone.clientHeight || 64) / 2;

        const dist = Math.abs(circleCenter - hitCenter);
        let pts = 0;
        let label = '';

        if (dist < circleSize * 0.4) {
          pts = POINTS_PERFECT; label = '✨ Perfect!';
        } else if (circleBot > hitZoneTop && circleTop < arenaH) {
          pts = POINTS_GOOD; label = '👍 Good!';
        } else {
          pts = 0; label = '⚡ Early!';
        }

        score += pts;
        window.SoundEngine?.play("correct");
        updateScoreUI();

        // Pop animation
        el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        el.style.transform  = 'scale(1.6)';
        el.style.opacity    = '0';
        setTimeout(() => el.remove(), 260);

        circleObj.removed = true;
        showFeedback(label + (pts > 0 ? ` +${pts}` : ''), col, pts === POINTS_PERFECT ? '#fdd34d' : pts > 0 ? '#4ade80' : '#aaa');
      };

      el.addEventListener('touchend', onTap, { passive: false });
      el.addEventListener('click', onTap);

      dom.arena.appendChild(el);
      activeCircles.push(circleObj);
    }

    /** Show floating feedback text in the given column. */
    function showFeedback(text, col, color) {
      if (!dom.arena) return;

      const arenaW    = dom.arena.clientWidth || 300;
      const arenaH    = dom.arena.clientHeight || 400;
      const colW      = arenaW / COLUMNS;
      const centerX   = col * colW + colW / 2;
      const startY    = arenaH - (dom.hitZone.clientHeight || 64) - 20;

      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        left: ${centerX}px;
        top: ${startY}px;
        transform: translateX(-50%);
        font-family: var(--font-display);
        font-size: clamp(0.75rem, 2.5vw, 1.1rem);
        color: ${color || 'var(--primary)'};
        pointer-events: none;
        z-index: 10;
        white-space: nowrap;
        text-shadow: 0 2px 6px rgba(0,0,0,0.6);
        animation: scoreFlash 0.9s ease-out forwards;
      `;
      el.textContent = text;
      dom.arena.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }

    /* ── Timer ── */
    function startTimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
        elapsed++;
        updateTimerUI();
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          triggerGameOver();
        }
      }, 1000);
    }

    /* ── Game Over ── */
    function triggerGameOver() {
      isGameOver = true;
      cancelAnimationFrame(animFrameId);
      clearTimeout(spawnTimeout);

      const key  = `rhythm-tap-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));

      const trophy    = score >= 200 ? '🏆' : score >= 100 ? '🥈' : '🥁';
      const isNewBest = score > best;

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        ${isNewBest
          ? `<div style="font-family:var(--font-body);font-size:var(--text-md);color:var(--primary);animation:bounceIn 0.5s 0.3s both;">🌟 최고 기록!</div>`
          : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최고: ${Math.max(score, best)}점</div>`
        }
      `;
      container.appendChild(overlay);

      if (typeof onGameOver === 'function') onGameOver(score);
    }

    /* ── UI updates ── */
    function updateScoreUI() {
      if (dom.scoreEl) dom.scoreEl.textContent = score;
    }

    function updateTimerUI() {
      if (!dom.timerDigit || !dom.timerBar) return;
      dom.timerDigit.textContent = timeLeft;
      dom.timerBar.style.width = `${(timeLeft / gameDuration) * 100}%`;
      const urgent = timeLeft <= 10;
      dom.timerDigit.classList.toggle('urgent', urgent);
      dom.timerBar.classList.toggle('urgent', urgent);
    }

    /* ── Destroy ── */
    function destroy() {
      isGameOver = true;
      clearInterval(timerInterval);
      clearTimeout(spawnTimeout);
      cancelAnimationFrame(animFrameId);
      if (container) container.innerHTML = '';
      activeCircles = [];
      dom = {};
    }

    buildUI();
    return { destroy };
  }

  /* ── Register ── */
  window.GameModules = window.GameModules || {};
  window.GameModules['rhythm-tap'] = { init };

})();
