'use strict';
/**
 * games/breakout/game.js
 * "블록 깨기" — Breakout / Brick Breaker
 *
 * Drag or swipe horizontally to move the paddle.
 * On-screen left/right buttons also available.
 * Ball bounces off walls, paddle, and bricks.
 * Clear all bricks to advance to the next level!
 *
 * Score: each brick = 10 × level pts.
 */

(function registerBreakout() {

  function init(container, options) {
    const { playerIndex = 0, playerColor = '#00bcd4', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score = 0, timeLeft = gameDuration, level = 1, lives = 3;
    let gameOver = false;
    let timerHandle = null, rafId = null;
    let lastTime = null;

    // Paddle
    let padX, padW, padH, padSpeed;

    // Ball
    let bx, by, bdx, bdy, ballR;

    // Bricks
    let bricks = [];

    // Input
    let btnLeft = false, btnRight = false;
    let dragStartX = null, lastDragX = null;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
      background: #0d0d1a;
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
      <span id="bo-score-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};">0</span>
      <span id="bo-level-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#fff;">Lv.1</span>
      <span id="bo-timer-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#fff;"></span>
      <span id="bo-lives-${playerIndex}" style="font-size:var(--text-md);">❤️❤️❤️</span>
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

    // Controls
    const ctrlBar = document.createElement('div');
    ctrlBar.style.cssText = `
      width: 100%;
      display: flex;
      justify-content: center;
      gap: 1em;
      padding: 0.3em 0.5em;
      box-sizing: border-box;
      flex-shrink: 0;
      background: rgba(0,0,0,0.3);
    `;

    function makeBtn(label, onDown, onUp) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        width: 4em; height: 3em;
        border: none; border-radius: 0.5em;
        background: rgba(255,255,255,0.12);
        color: #fff; font-size: clamp(1.2rem,3.5vw,2rem);
        cursor: pointer; touch-action: manipulation; user-select: none;
        transition: background 0.1s;
      `;
      btn.addEventListener('touchstart',  e => { e.preventDefault(); onDown(); btn.style.background='rgba(255,255,255,0.28)'; }, { passive: false });
      btn.addEventListener('touchend',    e => { e.preventDefault(); onUp();   btn.style.background=''; }, { passive: false });
      btn.addEventListener('mousedown',   () => { onDown(); btn.style.background='rgba(255,255,255,0.28)'; });
      btn.addEventListener('mouseup',     () => { onUp();   btn.style.background=''; });
      btn.addEventListener('mouseleave',  () => { onUp();   btn.style.background=''; });
      return btn;
    }

    ctrlBar.appendChild(makeBtn('◀', () => btnLeft = true,  () => btnLeft = false));
    ctrlBar.appendChild(makeBtn('▶', () => btnRight = true, () => btnRight = false));
    container.appendChild(ctrlBar);

    /* ── Resize / init dimensions ── */
    let W, H;
    function resize() {
      W = wrap.clientWidth  || 300;
      H = wrap.clientHeight || 400;
      canvas.width  = W;
      canvas.height = H;
      padW  = Math.max(50, W * 0.22);
      padH  = Math.max(8, H * 0.025);
      ballR = Math.max(6, W * 0.025);
      padSpeed = W * 0.9;
      if (!gameOver) resetBall();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ── Brick layout ── */
    const BRICK_ROWS   = 5;
    const BRICK_COLS   = 8;
    const BRICK_COLORS = ['#ef5350','#ff7043','#fdd835','#66bb6a','#29b6f6','#ab47bc'];

    function buildBricks() {
      bricks = [];
      const bW  = (W - 16) / BRICK_COLS;
      const bH  = Math.min(H * 0.055, 28);
      const top = H * 0.08;
      for (let r = 0; r < BRICK_ROWS; r++) {
        const col = BRICK_COLORS[r % BRICK_COLORS.length];
        for (let c = 0; c < BRICK_COLS; c++) {
          bricks.push({
            x: 8 + c * bW, y: top + r * (bH + 4),
            w: bW - 4, h: bH,
            color: col, alive: true
          });
        }
      }
    }

    function resetBall() {
      if (!padX) padX = (W - padW) / 2;
      bx = padX + padW / 2;
      by = H - padH - ballR - 8;
      const angle = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
      const speed = Math.min(W, H) * (0.55 + level * 0.06);
      bdx = Math.cos(angle) * speed;
      bdy = Math.sin(angle) * speed;
    }

    function resetPad() {
      padX = (W - padW) / 2;
    }

    /* ── Touch drag on canvas ── */
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      dragStartX = e.touches[0].clientX;
      lastDragX  = dragStartX;
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const x = e.touches[0].clientX;
      const dx = x - lastDragX;
      lastDragX = x;
      padX = Math.max(0, Math.min(W - padW, padX + dx));
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      dragStartX = lastDragX = null;
    }, { passive: false });

    /* ── Game loop ── */
    function loop(ts) {
      if (gameOver) return;
      const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0;
      lastTime = ts;

      // Paddle movement from buttons
      if (btnLeft)  padX = Math.max(0, padX - padSpeed * dt);
      if (btnRight) padX = Math.min(W - padW, padX + padSpeed * dt);

      // Ball movement
      bx += bdx * dt;
      by += bdy * dt;

      // Wall bounces
      if (bx - ballR < 0)   { bx = ballR;     bdx = Math.abs(bdx); }
      if (bx + ballR > W)   { bx = W - ballR; bdx = -Math.abs(bdx); }
      if (by - ballR < 0)   { by = ballR;      bdy = Math.abs(bdy); }

      // Ball fell below paddle
      if (by - ballR > H) {
        lives--;
        updateHUD();
        if (lives <= 0) { endGame(); return; }
        resetBall();
      }

      // Paddle collision
      const padY = H - padH - 4;
      if (bdy > 0 && by + ballR >= padY && by - ballR <= padY + padH &&
          bx >= padX - ballR && bx <= padX + padW + ballR) {
        // Angle based on hit position
        const rel = (bx - padX) / padW - 0.5; // -0.5 to 0.5
        const speed = Math.hypot(bdx, bdy);
        const angle = rel * (Math.PI * 0.6) - Math.PI / 2;
        bdx = Math.cos(angle) * speed;
        bdy = Math.sin(angle) * speed;
        by = padY - ballR - 1;
      }

      // Brick collisions
      let allDead = true;
      for (const b of bricks) {
        if (!b.alive) continue;
        allDead = false;
        if (bx + ballR > b.x && bx - ballR < b.x + b.w &&
            by + ballR > b.y && by - ballR < b.y + b.h) {
          b.alive = false;
          score += 10 * level;
        window.SoundEngine?.play("pop");
        window.SoundEngine?.play("correct");
          updateHUD();
          // Determine bounce axis
          const overlapL = (bx + ballR) - b.x;
          const overlapR = (b.x + b.w) - (bx - ballR);
          const overlapT = (by + ballR) - b.y;
          const overlapB = (b.y + b.h) - (by - ballR);
          const minH = Math.min(overlapL, overlapR);
          const minV = Math.min(overlapT, overlapB);
          if (minH < minV) bdx = -bdx;
          else             bdy = -bdy;
          break;
        }
      }

      if (allDead) nextLevel();

      draw();
      rafId = requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);

      // Bricks
      bricks.forEach(b => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);
      });

      // Paddle
      const padY = H - padH - 4;
      const grad = ctx.createLinearGradient(padX, padY, padX, padY + padH);
      grad.addColorStop(0, playerColor);
      grad.addColorStop(1, 'rgba(255,255,255,0.4)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(padX, padY, padW, padH, padH / 2);
      ctx.fill();

      // Ball
      const bg = ctx.createRadialGradient(bx - ballR * 0.3, by - ballR * 0.3, ballR * 0.1, bx, by, ballR);
      bg.addColorStop(0, '#fff');
      bg.addColorStop(1, playerColor);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ── Level / HUD ── */
    function nextLevel() {
      level++;
      buildBricks();
      resetBall();
    }

    function updateHUD() {
      const s = document.getElementById(`bo-score-${playerIndex}`);
      const l = document.getElementById(`bo-level-${playerIndex}`);
      const t = document.getElementById(`bo-timer-${playerIndex}`);
      const lv = document.getElementById(`bo-lives-${playerIndex}`);
      if (s)  s.textContent  = score;
      if (l)  l.textContent  = `Lv.${level}`;
      if (t)  { t.textContent = `${timeLeft}s`; t.style.color = timeLeft <= 10 ? '#ff5252' : '#fff'; }
      if (lv) lv.textContent = '❤️'.repeat(lives);
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

    /* ── End game ── */
    function endGame() {
      gameOver = true;
      cancelAnimationFrame(rafId);
      clearInterval(timerHandle);

      const key  = `breakout-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = score >= 500 ? '🏆' : score >= 200 ? '🥈' : '🧱';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">레벨 ${level} 도달</div>
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
      score = 0; timeLeft = gameDuration; level = 1; lives = 3; gameOver = false;
      lastTime = null;
      resetPad();
      buildBricks();
      resetBall();
      updateHUD();
      startTimer();
      rafId = requestAnimationFrame(loop);
    }

    // Wait for resize observer to fire first, then start
    function tryStart() {
      W = wrap.clientWidth  || 0;
      H = wrap.clientHeight || 0;
      if (W > 0 && H > 0) {
        startGame();
      } else {
        setTimeout(tryStart, 50);
      }
    }
    setTimeout(tryStart, 50);

    /* ── Destroy ── */
    function destroy() {
      gameOver = true;
      cancelAnimationFrame(rafId);
      clearInterval(timerHandle);
      ro.disconnect();
      if (container) container.innerHTML = '';
    }

    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['breakout'] = { init };

})();
