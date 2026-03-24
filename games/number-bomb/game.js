'use strict';
/**
 * games/number-bomb/game.js
 * "숫자 폭탄" — Number Bomb
 *
 * Number bubbles float upward from the bottom.
 * A target sum is shown at the top.
 * Tap TWO numbers that add up to the target to pop them!
 *
 * Correct pair  → +10 pts, new target, bubbles pop
 * Wrong pair    → both flash red briefly
 * Bubble escapes top → miss (no penalty)
 *
 * Target changes after each correct pair.
 * Speed increases over time.
 */

(function registerNumberBomb() {

  function init(container, options) {
    const { playerIndex = 0, playerColor = '#fdd835', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score = 0, timeLeft = gameDuration, isGameOver = false;
    let timerHandle = null, spawnHandle = null, rafId = null;
    let target = 0;
    let bubbles = []; // { el, value, y (0=bottom,1=top), selected, id }
    let selectedBubble = null;
    let elapsed = 0;
    let lastFrame = null;
    let idCounter = 0;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%;
      overflow: hidden; position: relative; background:#f7f3ee;
    `;

    // Top HUD
    const hud = document.createElement('div');
    hud.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.3em 0.6em; flex-shrink: 0; background: rgba(0,0,0,0.4);
      gap: 0.5em;
    `;
    hud.innerHTML = `
      <span id="nb-score-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};">0</span>
      <div style="text-align:center;">
        <div style="font-family:var(--font-body);font-size:var(--text-xs);color:#aaa;">두 수의 합</div>
        <div id="nb-target-${playerIndex}" style="font-family:var(--font-display);font-size:clamp(1.8rem,5vmin,3rem);color:#fff;line-height:1;"></div>
      </div>
      <span id="nb-timer-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#fff;"></span>
    `;
    container.appendChild(hud);

    // Timer bar
    const timerBarWrap = document.createElement('div');
    timerBarWrap.className = 'timer-bar-wrapper';
    timerBarWrap.style.flexShrink = '0';
    const timerBarFill = document.createElement('div');
    timerBarFill.className = 'timer-bar-fill';
    timerBarFill.style.width = '100%';
    timerBarWrap.appendChild(timerBarFill);
    container.appendChild(timerBarWrap);

    // Arena
    const arena = document.createElement('div');
    arena.style.cssText = 'position:relative;flex:1;overflow:hidden;min-height:0;';
    container.appendChild(arena);

    /* ── Refs ── */
    const scoreEl    = container.querySelector(`#nb-score-${playerIndex}`);
    const targetEl   = container.querySelector(`#nb-target-${playerIndex}`);
    const timerEl    = container.querySelector(`#nb-timer-${playerIndex}`);

    /* ── Helpers ── */
    const COLORS = ['#ef5350','#ff7043','#fdd835','#66bb6a','#29b6f6','#ab47bc','#f472b6','#4db6ac'];

    function newTarget() {
      // Pick a target 5-18 that allows at least 2 pairs from numbers 1-9
      target = 5 + Math.floor(Math.random() * 14);
      if (targetEl) targetEl.textContent = target;
    }

    function spawnBubble() {
      if (isGameOver) return;
      const value = 1 + Math.floor(Math.random() * 9);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const W = arena.clientWidth || 300;
      const size = Math.max(44, Math.min(W * 0.14, 72));
      const x = size / 2 + Math.random() * (W - size);
      const id = idCounter++;

      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, color-mix(in srgb, ${color} 80%, white), ${color});
        box-shadow: 0 0 14px 3px ${color}66;
        display: flex; align-items: center; justify-content: center;
        font-family: var(--font-display);
        font-size: ${size * 0.42}px;
        color: #fff;
        cursor: pointer;
        touch-action: manipulation; user-select: none;
        transition: box-shadow 0.1s;
        left: ${x - size / 2}px;
      `;
      el.textContent = value;

      const bubble = { el, value, y: -size, size, x, color, selected: false, id, removed: false };
      bubbles.push(bubble);
      arena.appendChild(el);

      const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isGameOver || bubble.removed) return;
        handleTap(bubble);
      };
      el.addEventListener('touchstart', onTap, { passive: false });
      el.addEventListener('click', onTap);
    }

    function handleTap(bubble) {
      if (!selectedBubble) {
        // Select first
        selectedBubble = bubble;
        bubble.selected = true;
        bubble.el.style.boxShadow = `0 0 0 4px #fff, 0 0 20px 6px ${bubble.color}`;
        bubble.el.style.transform = 'scale(1.15)';
      } else if (selectedBubble.id === bubble.id) {
        // Deselect
        selectedBubble = null;
        bubble.selected = false;
        bubble.el.style.boxShadow = `0 0 14px 3px ${bubble.color}66`;
        bubble.el.style.transform = '';
      } else {
        // Check pair
        const a = selectedBubble, b = bubble;
        if (a.value + b.value === target) {
          // Correct!
          score += 10;
        window.SoundEngine?.play("correct");
          updateHUD();
          popBubble(a);
          popBubble(b);
          selectedBubble = null;
          newTarget();
          showFeedback(`+10 🎯`, a.x, a.y);
        } else {
          // Wrong
          flashWrong(a);
          flashWrong(b);
          selectedBubble = null;
        }
      }
    }

    function popBubble(bubble) {
      bubble.removed = true;
      bubble.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      bubble.el.style.transform  = 'scale(1.8)';
      bubble.el.style.opacity    = '0';
      setTimeout(() => bubble.el.remove(), 260);
    }

    function flashWrong(bubble) {
      bubble.selected = false;
      bubble.el.style.transform   = '';
      bubble.el.style.background  = '#ef5350';
      bubble.el.style.boxShadow   = '0 0 14px 3px #ef535066';
      setTimeout(() => {
        if (bubble.removed) return;
        bubble.el.style.background = `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${bubble.color} 80%, white), ${bubble.color})`;
        bubble.el.style.boxShadow  = `0 0 14px 3px ${bubble.color}66`;
      }, 400);
    }

    function showFeedback(text, x, y) {
      const el = document.createElement('div');
      el.style.cssText = `
        position:absolute; left:${x}px; top:${arena.clientHeight * (1 - y) - 40}px;
        transform:translateX(-50%);
        font-family:var(--font-display); font-size:clamp(1rem,3vmin,1.5rem);
        color:#fdd835; pointer-events:none; z-index:10; white-space:nowrap;
        text-shadow:0 2px 6px rgba(0,0,0,0.8);
        animation: scoreFlash 0.9s ease-out forwards;
      `;
      el.textContent = text;
      arena.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }

    /* ── Game loop ── */
    function getFallSpeed() {
      // Fraction of arena height per second; increases over time
      const t = Math.min(elapsed / gameDuration, 1);
      return 0.06 + t * 0.1;
    }

    function loop(ts) {
      if (isGameOver) return;
      const dt = lastFrame ? Math.min((ts - lastFrame) / 1000, 0.05) : 0;
      lastFrame = ts;

      const H = arena.clientHeight || 400;
      const toRemove = [];

      bubbles.forEach(b => {
        if (b.removed) return;
        b.y += getFallSpeed() * dt * H; // px upward
        const top = H - b.y - b.size;
        b.el.style.top = `${top}px`;

        if (top < -b.size) {
          b.removed = true;
          b.el.remove();
          if (selectedBubble && selectedBubble.id === b.id) selectedBubble = null;
          toRemove.push(b);
        }
      });

      bubbles = bubbles.filter(b => !b.removed);
      rafId = requestAnimationFrame(loop);
    }

    /* ── HUD ── */
    function updateHUD() {
      if (scoreEl)     scoreEl.textContent = score;
      if (timerEl)     { timerEl.textContent = `${timeLeft}s`; timerEl.style.color = timeLeft <= 10 ? '#ff5252' : '#fff'; }
      if (timerBarFill){ timerBarFill.style.width = `${(timeLeft / gameDuration) * 100}%`; }
      const urgent = timeLeft <= 10;
      if (timerBarFill) timerBarFill.classList.toggle('urgent', urgent);
    }

    /* ── Timers ── */
    function startTimers() {
      timerHandle = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        elapsed++;
        updateHUD();
        if (timeLeft <= 0) endGame();
      }, 1000);

      scheduleSpawn();
    }

    function getSpawnInterval() {
      const t = Math.min(elapsed / gameDuration, 1);
      return Math.max(700, 1800 - t * 1100);
    }

    function scheduleSpawn() {
      if (isGameOver) return;
      spawnHandle = setTimeout(() => {
        spawnBubble();
        scheduleSpawn();
      }, getSpawnInterval());
    }

    /* ── End ── */
    function endGame() {
      isGameOver = true;
      clearInterval(timerHandle);
      clearTimeout(spawnHandle);
      cancelAnimationFrame(rafId);

      const key  = `number-bomb-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = score >= 200 ? '🏆' : score >= 100 ? '🥈' : '💣';

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

    /* ── Start ── */
    function startGame() {
      score = 0; timeLeft = gameDuration; elapsed = 0; isGameOver = false;
      lastFrame = null;
      bubbles = []; selectedBubble = null;
      newTarget();
      updateHUD();
      // Pre-spawn a few bubbles
      for (let i = 0; i < 4; i++) setTimeout(spawnBubble, i * 300);
      startTimers();
      rafId = requestAnimationFrame(loop);
    }

    function destroy() {
      isGameOver = true;
      clearInterval(timerHandle);
      clearTimeout(spawnHandle);
      cancelAnimationFrame(rafId);
      if (container) container.innerHTML = '';
    }

    startGame();
    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['number-bomb'] = { init };

})();
