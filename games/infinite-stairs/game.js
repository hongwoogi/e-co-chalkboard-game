'use strict';
/**
 * games/infinite-stairs/game.js
 * "무한의 계단" — Infinite Stairs
 *
 * Gameplay:
 *  1. Character sits on a platform at the bottom center.
 *  2. The next platform appears upper-left or upper-right (random).
 *  3. Tap LEFT or RIGHT to step onto it. Wrong = game over.
 *  4. A countdown bar shrinks per step — miss it = game over.
 *  5. Speed increases every 10 steps.
 */

(function registerInfiniteStairs() {

  function init(container, options) {
    const { playerIndex = 0, playerColor = '#7ed3ff', onGameOver } = options || {};

    /* ── Constants ─────────────────────────────────────────── */
    const PLAT_W   = 110;
    const PLAT_H   = 14;
    const STEP_X   = 72;   // horizontal jump distance
    const STEP_Y   = 56;   // vertical   jump distance
    const CHAR_W   = 26;
    const CHAR_H   = 26;
    const BASE_TIME = 2400; // ms for first step
    const MIN_TIME  = 600;

    /* ── State ─────────────────────────────────────────────── */
    let score = 0, dead = false;
    let platforms = [];   // { x, y, w, fresh }
    let nextDir  = 'left';
    let charX = 0, charY = 0;
    let camY  = 0, camYTarget = 0;
    let animating  = false;
    let animPct    = 0;
    let fromX = 0, fromY = 0, toX = 0, toY = 0;
    let stepTime   = BASE_TIME;   // ms allowed per step
    let stepStart  = 0;
    let rafId      = null;
    let shakeAmt   = 0;
    let blinkTimer = null;

    /* ── DOM ────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = `
      display:flex;flex-direction:column;height:100%;
      overflow:hidden;position:relative;background:#f7f3ee;
    `;

    // HUD
    const hud = document.createElement('div');
    hud.style.cssText = `
      flex-shrink:0;display:flex;align-items:center;gap:8px;
      padding:6px 10px;background:rgba(0,0,0,0.45);
      border-bottom:3px solid ${playerColor}88;
    `;
    const scoreEl = document.createElement('span');
    scoreEl.style.cssText = `
      font-family:var(--font-display);font-size:1.5rem;
      color:${playerColor};text-shadow:2px 2px 0 rgba(0,0,0,0.5);flex:1;
    `;
    scoreEl.textContent = '0';

    // Timer bar
    const timerWrap = document.createElement('div');
    timerWrap.style.cssText = `
      flex:1;height:10px;background:rgba(0,0,0,0.10);
      border:2px solid rgba(0,0,0,0.15);border-radius:4px;overflow:hidden;
    `;
    const timerFill = document.createElement('div');
    timerFill.style.cssText = `height:100%;width:100%;background:${playerColor};transition:none;`;
    timerWrap.appendChild(timerFill);

    hud.append(scoreEl, timerWrap);
    container.appendChild(hud);

    // Canvas
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'flex:1;position:relative;overflow:hidden;min-height:0;';
    container.appendChild(canvasWrap);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;';
    canvasWrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    // Controls
    const ctrlRow = document.createElement('div');
    ctrlRow.style.cssText = `
      flex-shrink:0;display:flex;gap:8px;padding:8px 10px;
      background:rgba(0,0,0,0.35);border-top:3px solid rgba(0,0,0,0.08);
    `;

    function makeBtn(label, dir) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        flex:1;padding:12px 0;font-size:1.8rem;font-weight:bold;cursor:pointer;
        background:color-mix(in srgb,${playerColor} 40%,#f0ece5);
        color:${playerColor};border:3px solid ${playerColor};border-radius:12px;
        box-shadow:0 5px 0 rgba(0,0,0,0.55);
        transition:transform 0.07s,box-shadow 0.07s;
        font-family:var(--font-display);touch-action:manipulation;user-select:none;
      `;
      const press = (e) => {
        e.preventDefault();
        btn.style.transform = 'translateY(5px)';
        btn.style.boxShadow = '0 0 0 rgba(0,0,0,0.55)';
        handleInput(dir);
      };
      const release = () => {
        btn.style.transform = '';
        btn.style.boxShadow = `0 5px 0 rgba(0,0,0,0.55)`;
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      return btn;
    }

    const leftBtn  = makeBtn('◀', 'left');
    const rightBtn = makeBtn('▶', 'right');
    ctrlRow.append(leftBtn, rightBtn);
    container.appendChild(ctrlRow);

    /* ── Keyboard ───────────────────────────────────────────── */
    function onKey(e) {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') handleInput('left');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleInput('right');
    }
    document.addEventListener('keydown', onKey);

    /* ── Init game ──────────────────────────────────────────── */
    function initGame() {
      const W = canvas.width, H = canvas.height;
      platforms = [];
      score = 0; dead = false; animating = false; shakeAmt = 0;
      scoreEl.textContent = '0';

      // First platform: center bottom
      const p0 = { x: W/2 - PLAT_W/2, y: H - 90, w: PLAT_W };
      platforms.push(p0);
      charX = W / 2;
      charY = p0.y - CHAR_H;
      camY = 0;
      camYTarget = 0;

      stepTime = BASE_TIME;
      spawnNext();
      stepStart = performance.now();
    }

    function spawnNext() {
      const last = platforms[platforms.length - 1];
      nextDir = Math.random() < 0.5 ? 'left' : 'right';
      const nx = nextDir === 'left'
        ? last.x - STEP_X
        : last.x + STEP_X;
      platforms.push({ x: nx, y: last.y - STEP_Y, w: PLAT_W, fresh: true });
    }

    /* ── Input ──────────────────────────────────────────────── */
    function handleInput(dir) {
      if (dead || animating) return;
      if (dir === nextDir) {
        // Correct
        score++;
        scoreEl.textContent = score;
        stepTime = Math.max(MIN_TIME, BASE_TIME - score * 40);

        const target = platforms[platforms.length - 1];
        target.fresh = false;

        fromX = charX; fromY = charY;
        toX   = target.x + target.w / 2;
        toY   = target.y - CHAR_H;
        animPct   = 0;
        animating = true;
      } else {
        // Wrong!
        doDie();
      }
    }

    function doDie() {
      dead = true;
      shakeAmt = 14;
      clearTimeout(blinkTimer);
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { onGameOver?.(score); }, 900);
    }

    /* ── Main loop ──────────────────────────────────────────── */
    let prevTs = 0;
    function loop(ts) {
      const dt = Math.min(ts - prevTs, 60);
      prevTs = ts;

      const W = canvas.width, H = canvas.height;

      // Timer check
      if (!dead && !animating) {
        const elapsed = ts - stepStart;
        const ratio = Math.max(0, 1 - elapsed / stepTime);
        timerFill.style.width = (ratio * 100) + '%';
        // Color shifts red as time runs out
        if (ratio < 0.3) timerFill.style.background = '#f87171';
        else if (ratio < 0.6) timerFill.style.background = '#fdd34d';
        else timerFill.style.background = playerColor;

        if (ratio <= 0) { doDie(); }
      }

      // Animate character jump
      if (animating) {
        animPct += 0.09;
        if (animPct >= 1) {
          animPct = 1;
          charX = toX; charY = toY;
          animating = false;
          camYTarget = charY - H * 0.62;
          stepStart = ts;
          spawnNext();
          if (platforms.length > 24) platforms.splice(0, platforms.length - 24);
        } else {
          const t = 1 - Math.pow(1 - animPct, 2.2);
          charX = fromX + (toX - fromX) * t;
          charY = fromY + (toY - fromY) * t;
          charY -= 28 * Math.sin(animPct * Math.PI); // arc
          camYTarget = charY - H * 0.62;
        }
      }

      // Smooth camera
      camY += (camYTarget - camY) * 0.12;

      // Shake
      if (shakeAmt > 0) shakeAmt *= 0.75;
      const sx = dead ? (Math.random() - 0.5) * shakeAmt * 2 : 0;
      const sy = dead ? (Math.random() - 0.5) * shakeAmt * 2 : 0;

      // ── Draw ──────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#f7f3ee';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid lines for depth
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      for (let gy = ((-camY) % 40); gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      ctx.save();
      ctx.translate(sx, sy - camY);

      // Platforms
      platforms.forEach((p, i) => {
        const isNext = i === platforms.length - 1 && p.fresh;
        const pulse  = isNext ? 0.72 + 0.28 * Math.sin(ts / 180) : 1;

        if (isNext) {
          ctx.fillStyle = playerColor;
          ctx.globalAlpha = pulse;
          ctx.shadowColor = playerColor;
          ctx.shadowBlur  = 10;
        } else {
          ctx.fillStyle   = '#8ba8c8';
          ctx.globalAlpha = 1;
          ctx.shadowBlur  = 0;
        }
        roundRect(ctx, p.x, p.y, p.w, PLAT_H, 4); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;

        // Underside shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        roundRect(ctx, p.x + 2, p.y + PLAT_H, p.w - 2, 6, 2); ctx.fill();

        // Arrow hint on next platform
        if (isNext) {
          const arrowPulse = 0.6 + 0.4 * Math.sin(ts / 180);
          ctx.fillStyle = `rgba(${hexRgb(playerColor)},${arrowPulse})`;
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(nextDir === 'left' ? '◀' : '▶', p.x + p.w / 2, p.y - 14);
        }
      });

      // Character
      if (!dead || Math.floor(ts / 80) % 2 === 0) {
        ctx.fillStyle = playerColor;
        ctx.shadowColor = playerColor;
        ctx.shadowBlur  = 6;
        roundRect(ctx, charX - CHAR_W/2, charY, CHAR_W, CHAR_H, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Eyes
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(charX - 8, charY + 8, 4, 5);
        ctx.fillRect(charX + 4, charY + 8, 4, 5);
        // Smile (when alive)
        if (!dead) {
          ctx.strokeStyle = '#2a2a2a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(charX, charY + CHAR_H - 8, 5, 0, Math.PI);
          ctx.stroke();
        }
      }

      ctx.restore();

      // Dead overlay
      if (dead) {
        ctx.fillStyle = 'rgba(200,30,30,0.15)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#cc2222';
        ctx.font = `bold ${Math.round(W * 0.1)}px var(--font-display, sans-serif)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥 틀렸어요!', W/2, H/2);
      }

      rafId = requestAnimationFrame(loop);
    }

    /* ── Helpers ────────────────────────────────────────────── */
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
      ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
      ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
      ctx.closePath();
    }

    function hexRgb(hex) {
      hex = hex.replace('#','');
      if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
      const n = parseInt(hex,16);
      return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
    }

    /* ── Resize ─────────────────────────────────────────────── */
    function resize() {
      canvas.width  = canvasWrap.clientWidth  || 300;
      canvas.height = canvasWrap.clientHeight || 400;
      initGame();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvasWrap);
    resize();

    rafId = requestAnimationFrame(loop);

    return {
      destroy() {
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKey);
        ro.disconnect();
      }
    };
  }

  if (!window.GameModules) window.GameModules = {};
  window.GameModules['infinite-stairs'] = { init };
})();
