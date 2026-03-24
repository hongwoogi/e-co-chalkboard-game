'use strict';
/**
 * games/snake/game.js
 * "뱀 게임" — Classic Snake
 *
 * Swipe or use on-screen arrow buttons to change direction.
 * Eat food to grow and score points.
 * Game over when hitting a wall or yourself.
 *
 * Score: each food = 10 × level pts.
 * Speed increases every 5 foods eaten.
 */

(function registerSnake() {

  const GRID = 20; // cells per row/col

  function init(container, options) {
    const { playerIndex = 0, playerColor = '#66bb6a', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score = 0, timeLeft = gameDuration, foodEaten = 0;
    let gameOver = false, timerHandle = null, stepHandle = null;
    let snake, dir, nextDir, food;
    let cellSize;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
      background:#f7f3ee;
    `;

    // HUD
    const hud = document.createElement('div');
    hud.style.cssText = `
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.3em 0.6em;
      box-sizing: border-box;
      flex-shrink: 0;
    `;
    hud.innerHTML = `
      <span id="sn-score-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};">0</span>
      <span id="sn-timer-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#fff;"></span>
      <span id="sn-len-${playerIndex}" style="font-family:var(--font-body);font-size:var(--text-sm);color:#aaa;">길이: 3</span>
    `;
    container.appendChild(hud);

    // Canvas
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;min-height:0;width:100%;';
    container.appendChild(wrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;';
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Control buttons
    const ctrlWrap = document.createElement('div');
    ctrlWrap.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.2em 0;
      flex-shrink: 0;
      background: rgba(0,0,0,0.3);
      gap: 0.2em;
    `;

    function makeBtn(label, action) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        width: 3em; height: 2.6em;
        border: none; border-radius: 0.4em;
        background: rgba(255,255,255,0.12);
        color: #fff; font-size: clamp(1rem,3vw,1.6rem);
        cursor: pointer; touch-action: manipulation; user-select: none;
      `;
      const fire = (e) => { e.preventDefault(); action(); };
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('click', fire);
      return btn;
    }

    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;justify-content:center;';
    row1.appendChild(makeBtn('▲', () => setDir(0, -1)));

    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;justify-content:center;gap:0.8em;';
    row2.appendChild(makeBtn('◀', () => setDir(-1, 0)));
    row2.appendChild(makeBtn('▶', () => setDir(1, 0)));

    const row3 = document.createElement('div');
    row3.style.cssText = 'display:flex;justify-content:center;';
    row3.appendChild(makeBtn('▼', () => setDir(0, 1)));

    ctrlWrap.appendChild(row1);
    ctrlWrap.appendChild(row2);
    ctrlWrap.appendChild(row3);
    container.appendChild(ctrlWrap);

    /* ── Resize ── */
    function resize() {
      const W = wrap.clientWidth  || 300;
      const H = wrap.clientHeight || 300;
      cellSize = Math.floor(Math.min(W, H) / GRID);
      canvas.width  = cellSize * GRID;
      canvas.height = cellSize * GRID;
      draw();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ── Swipe ── */
    let touchX = null, touchY = null;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
      else setDir(0, dy > 0 ? 1 : -1);
      touchX = touchY = null;
    }, { passive: false });

    /* ── Direction ── */
    function setDir(dx, dy) {
      // Prevent reversing
      if (dx === -dir.x && dy === -dir.y) return;
      if (dx !== 0 || dy !== 0) nextDir = { x: dx, y: dy };
    }

    /* ── Food placement ── */
    function placeFood() {
      const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
      let fx, fy;
      do {
        fx = Math.floor(Math.random() * GRID);
        fy = Math.floor(Math.random() * GRID);
      } while (occupied.has(`${fx},${fy}`));
      food = { x: fx, y: fy };
    }

    /* ── Step interval ── */
    function getStepMs() {
      return Math.max(80, 220 - foodEaten * 8);
    }

    function scheduleStep() {
      clearInterval(stepHandle);
      stepHandle = setInterval(step, getStepMs());
    }

    function step() {
      if (gameOver) return;
      dir = { ...nextDir };
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Wall collision
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        endGame(); return;
      }
      // Self collision
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        endGame(); return;
      }

      snake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        foodEaten++;
        score += 10 * Math.floor(foodEaten / 5 + 1);
        window.SoundEngine?.play("eat");
        window.SoundEngine?.play("correct");
        placeFood();
        scheduleStep(); // speed up
        updateHUD();
      } else {
        snake.pop();
      }
      draw();
    }

    /* ── Draw ── */
    function draw() {
      if (!cellSize) return;
      ctx.fillStyle = '#0d1a0d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid dots
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
          ctx.fillRect(c * cellSize + cellSize / 2 - 1, r * cellSize + cellSize / 2 - 1, 2, 2);

      // Snake
      snake.forEach((seg, i) => {
        const alpha = i === 0 ? 1 : 0.85 - (i / snake.length) * 0.4;
        ctx.globalAlpha = Math.max(0.3, alpha);
        ctx.fillStyle = i === 0 ? '#fff' : playerColor;
        const pad = i === 0 ? 1 : 2;
        ctx.beginPath();
        ctx.roundRect(
          seg.x * cellSize + pad,
          seg.y * cellSize + pad,
          cellSize - pad * 2,
          cellSize - pad * 2,
          i === 0 ? cellSize * 0.3 : cellSize * 0.2
        );
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Food
      const fc = food;
      const cx = fc.x * cellSize + cellSize / 2;
      const cy = fc.y * cellSize + cellSize / 2;
      const r  = cellSize * 0.38;
      const fg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      fg.addColorStop(0, '#fff');
      fg.addColorStop(1, '#ef5350');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ── HUD ── */
    function updateHUD() {
      const s = document.getElementById(`sn-score-${playerIndex}`);
      const t = document.getElementById(`sn-timer-${playerIndex}`);
      const l = document.getElementById(`sn-len-${playerIndex}`);
      if (s) s.textContent = score;
      if (t) { t.textContent = `${timeLeft}s`; t.style.color = timeLeft <= 10 ? '#ff5252' : '#fff'; }
      if (l) l.textContent = `길이: ${snake.length}`;
    }

    /* ── Timer ── */
    function startTimer() {
      timerHandle = setInterval(() => {
        if (gameOver) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    /* ── End ── */
    function endGame() {
      gameOver = true;
      clearInterval(stepHandle);
      clearInterval(timerHandle);

      const key  = `snake-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = score >= 200 ? '🏆' : score >= 100 ? '🥈' : '🐍';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최대 길이: ${snake.length}</div>
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
      score = 0; timeLeft = gameDuration; foodEaten = 0; gameOver = false;
      snake = [
        { x: Math.floor(GRID / 2),     y: Math.floor(GRID / 2) },
        { x: Math.floor(GRID / 2) - 1, y: Math.floor(GRID / 2) },
        { x: Math.floor(GRID / 2) - 2, y: Math.floor(GRID / 2) },
      ];
      dir     = { x: 1, y: 0 };
      nextDir = { x: 1, y: 0 };
      placeFood();
      resize();
      updateHUD();
      startTimer();
      scheduleStep();
    }

    setTimeout(startGame, 80);

    /* ── Destroy ── */
    function destroy() {
      gameOver = true;
      clearInterval(stepHandle);
      clearInterval(timerHandle);
      ro.disconnect();
      if (container) container.innerHTML = '';
    }

    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['snake'] = { init };

})();
