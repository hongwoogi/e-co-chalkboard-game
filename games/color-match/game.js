'use strict';
/**
 * games/color-match/game.js
 * "색깔 맞추기" — 나무블럭 지우기
 *
 * Gameplay:
 *  A stack of colored wooden blocks (red / blue / green) is shown.
 *  Tap the button matching the color of the BOTTOM block to remove it.
 *  Wrong tap → 1-second freeze.
 *  60-second timer — clear as many blocks as possible!
 *  Clearing a full stack earns a +20 bonus.
 */

(function registerColorMatch() {

  const COLORS = [
    { id: 'red',   label: '빨강', hex: '#ff5252', border: '#c41c00', shadow: '#b71c1c' },
    { id: 'blue',  label: '파랑', hex: '#2979ff', border: '#0039cb', shadow: '#01579b' },
    { id: 'green', label: '초록', hex: '#00c853', border: '#007b20', shadow: '#1b5e20' },
  ];

  const STACK_SIZE  = 12;
  const PTS_CORRECT = 10;
  const PTS_BONUS   = 20;  // full-stack clear bonus
  const FREEZE_MS   = 1000;

  /* ── Stack generator ───────────────────────────────────── */
  function makeStack() {
    const blocks = [];
    for (let i = 0; i < STACK_SIZE; i++) {
      blocks.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
    return blocks;
  }

  /* ── init ──────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = '#ff5252', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    let score         = 0;
    let timeLeft      = gameDuration;
    let isGameOver    = false;
    let isFrozen      = false;
    let freezeTimeout = null;
    let timerInterval = null;
    let stack         = [];  // index 0 = top, last = bottom

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display:flex; flex-direction:column; height:100%;
      overflow:hidden; position:relative; background:#f7f3ee;
    `;

    /* HUD */
    const hud = document.createElement('div');
    hud.style.cssText = `
      display:flex; justify-content:space-between; align-items:center;
      padding:8px 14px; background:rgba(0,0,0,0.06);
      border-bottom:2px solid rgba(0,0,0,0.08); flex-shrink:0;
    `;
    hud.innerHTML = `
      <span id="cm-score-${playerIndex}" style="font-family:var(--font-display);font-size:1.1rem;font-weight:bold;color:${playerColor};">0점</span>
      <span id="cm-count-${playerIndex}" style="font-family:var(--font-body);font-size:0.78rem;color:#888;"></span>
      <span id="cm-timer-${playerIndex}" style="font-family:var(--font-display);font-size:1.1rem;font-weight:bold;color:#3d2b1f;">${gameDuration}s</span>
    `;
    container.appendChild(hud);

    /* Timer bar */
    const timerBarWrap = document.createElement('div');
    timerBarWrap.style.cssText = 'flex-shrink:0;height:5px;background:rgba(0,0,0,0.07);overflow:hidden;';
    const timerBarFill = document.createElement('div');
    timerBarFill.style.cssText = `height:100%;width:100%;background:${playerColor};transition:width 0.5s linear;`;
    timerBarWrap.appendChild(timerBarFill);
    container.appendChild(timerBarWrap);

    /* Stack area */
    const stackArea = document.createElement('div');
    stackArea.style.cssText = `
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:flex-end;
      padding:10px 20px 6px; overflow:hidden; gap:4px; min-height:0;
    `;
    container.appendChild(stackArea);

    /* Freeze overlay */
    const freezeEl = document.createElement('div');
    freezeEl.style.cssText = `
      position:absolute; inset:0; display:none; flex-direction:column;
      align-items:center; justify-content:center;
      background:rgba(30,10,10,0.45);
      font-family:var(--font-display); color:#fff;
      z-index:5; pointer-events:all; gap:8px;
    `;
    freezeEl.innerHTML = `
      <div style="font-size:2.8rem;">🚫</div>
      <div style="font-size:1.1rem;font-weight:bold;letter-spacing:0.04em;">1초 대기...</div>
    `;
    container.appendChild(freezeEl);

    /* Color buttons */
    const btnArea = document.createElement('div');
    btnArea.style.cssText = `
      display:flex; gap:10px;
      padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));
      flex-shrink:0; justify-content:center;
    `;
    container.appendChild(btnArea);

    COLORS.forEach(color => {
      const btn = document.createElement('button');
      btn.dataset.colorId = color.id;
      btn.style.cssText = `
        flex:1; max-width:110px;
        height:clamp(54px,13vw,76px);
        border-radius:14px;
        border:3px solid ${color.border};
        background:${color.hex};
        box-shadow:0 5px 0 ${color.shadow};
        font-family:var(--font-display);
        font-size:clamp(1rem,3vw,1.35rem);
        font-weight:bold; color:#fff;
        cursor:pointer; touch-action:manipulation; user-select:none;
        transition:transform 0.07s, box-shadow 0.07s;
        text-shadow:0 1px 4px rgba(0,0,0,0.5);
      `;
      btn.textContent = color.label;
      btn.addEventListener('pointerdown', () => {
        btn.style.transform = 'translateY(5px)';
        btn.style.boxShadow = '0 0 0 transparent';
      });
      btn.addEventListener('pointerup', () => {
        btn.style.transform = '';
        btn.style.boxShadow = `0 5px 0 ${color.shadow}`;
      });
      btn.addEventListener('click', () => onColorTap(color));
      btnArea.appendChild(btn);
    });

    /* ── Render stack ── */
    function renderStack() {
      stackArea.innerHTML = '';
      const n = stack.length;
      if (n === 0) return;

      const H = stackArea.clientHeight || 260;
      const blockH = Math.min(Math.floor((H - (n - 1) * 4) / Math.max(n, 8)), 54);

      stack.forEach((color, i) => {
        const isBottom = (i === n - 1);
        const block = document.createElement('div');
        block.style.cssText = `
          width:100%; max-width:320px; height:${blockH}px;
          border-radius:10px;
          background:${color.hex};
          border:3px solid ${color.border};
          box-shadow:${isBottom
            ? `0 4px 0 ${color.shadow}, 0 0 0 3px rgba(255,255,255,0.5), 0 0 12px 2px ${color.hex}88`
            : `0 3px 0 ${color.shadow}`};
          display:flex; align-items:center; justify-content:center;
          font-family:var(--font-display);
          font-size:clamp(0.75rem,2.2vw,1rem);
          font-weight:bold; color:rgba(255,255,255,0.92);
          text-shadow:0 1px 3px rgba(0,0,0,0.45);
          flex-shrink:0; position:relative; overflow:hidden;
          opacity:${isBottom ? 1 : (0.55 + 0.45 * (i / n))};
          ${isBottom ? 'animation:cmBottomIn 0.25s ease-out both;' : ''}
        `;
        /* Wood grain */
        block.innerHTML = `
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(
            90deg,transparent,transparent 28px,rgba(255,255,255,0.07) 28px,rgba(255,255,255,0.07) 29px
          );pointer-events:none;border-radius:8px;"></div>
          <span style="position:relative;z-index:1;">${color.label}</span>
        `;
        /* Arrow on bottom block */
        if (isBottom) {
          const arrow = document.createElement('div');
          arrow.style.cssText = `
            position:absolute; right:12px;
            font-size:1.1rem; z-index:2;
            animation:cmArrow 0.55s ease-in-out infinite alternate;
          `;
          arrow.textContent = '◀';
          block.appendChild(arrow);
        }
        stackArea.appendChild(block);
      });

      const countEl = container.querySelector(`#cm-count-${playerIndex}`);
      if (countEl) countEl.textContent = `${n}블럭 남음`;
    }

    /* ── Tap handler ── */
    function onColorTap(color) {
      if (isGameOver || isFrozen || stack.length === 0) return;
      const bottom = stack[stack.length - 1];

      if (color.id === bottom.id) {
        /* Correct */
        score += PTS_CORRECT;
        window.SoundEngine?.play('correct');
        stack.pop();
        if (stack.length === 0) {
          score += PTS_BONUS;
          stack = makeStack();
          showBonus();
        }
        renderStack();
        updateHUD();
      } else {
        /* Wrong — freeze */
        window.SoundEngine?.play('wrong');
        setFrozen(true);
        clearTimeout(freezeTimeout);
        freezeTimeout = setTimeout(() => setFrozen(false), FREEZE_MS);
      }
    }

    /* ── Freeze ── */
    function setFrozen(frozen) {
      isFrozen = frozen;
      freezeEl.style.display = frozen ? 'flex' : 'none';
      btnArea.querySelectorAll('button').forEach(b => {
        b.style.opacity       = frozen ? '0.45' : '1';
        b.style.pointerEvents = frozen ? 'none' : 'auto';
      });
    }

    /* ── Bonus flash ── */
    function showBonus() {
      const flash = document.createElement('div');
      flash.style.cssText = `
        position:absolute; top:40%; left:50%; transform:translate(-50%,-50%);
        font-family:var(--font-display); font-size:1.8rem; font-weight:bold;
        color:#fdd835; text-shadow:0 2px 8px rgba(0,0,0,0.6);
        pointer-events:none; z-index:10; white-space:nowrap;
        animation:cmBonus 0.8s ease-out forwards;
      `;
      flash.textContent = `🎉 +${PTS_BONUS} 보너스!`;
      container.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());
    }

    /* ── HUD ── */
    function updateHUD() {
      const scoreEl = container.querySelector(`#cm-score-${playerIndex}`);
      const timerEl = container.querySelector(`#cm-timer-${playerIndex}`);
      if (scoreEl) scoreEl.textContent = `${score}점`;
      if (timerEl) {
        timerEl.textContent = `${timeLeft}s`;
        timerEl.style.color = timeLeft <= 10 ? '#ff5252' : '#3d2b1f';
      }
      timerBarFill.style.width = `${(timeLeft / gameDuration) * 100}%`;
      timerBarFill.style.background = timeLeft <= 10 ? '#ff5252' : playerColor;
    }

    /* ── Timer ── */
    function startTimers() {
      timerInterval = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    /* ── End game ── */
    function endGame() {
      isGameOver = true;
      clearInterval(timerInterval);
      clearTimeout(freezeTimeout);
      setFrozen(false);

      const key  = `color-match-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = score >= 300 ? '🏆' : score >= 150 ? '🥈' : '🎨';

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

    /* ── Inject keyframes ── */
    if (!document.getElementById('cm-style')) {
      const s = document.createElement('style');
      s.id = 'cm-style';
      s.textContent = `
        @keyframes cmBottomIn {
          0%   { transform: scaleX(0.9) scaleY(0.85); opacity: 0.5; }
          100% { transform: scaleX(1)   scaleY(1);    opacity: 1;   }
        }
        @keyframes cmArrow {
          from { transform: translateX(0); }
          to   { transform: translateX(-5px); }
        }
        @keyframes cmBonus {
          0%   { transform: translate(-50%,-50%) scale(0.7); opacity: 1; }
          60%  { transform: translate(-50%,-80%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%,-110%) scale(1);  opacity: 0; }
        }
      `;
      document.head.appendChild(s);
    }

    /* ── Start ── */
    stack = makeStack();
    renderStack();
    updateHUD();
    startTimers();

    return {
      destroy() {
        isGameOver = true;
        clearInterval(timerInterval);
        clearTimeout(freezeTimeout);
        container.innerHTML = '';
      }
    };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['color-match'] = { init };

})();
