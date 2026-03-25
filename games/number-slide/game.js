'use strict';
/**
 * games/number-slide/game.js
 * "넘버 슬라이드" — Make the Target (24-game style)
 *
 * 4 numbers are shown. Use +, -, ×, ÷ to reach the target!
 * Expression is evaluated left-to-right (no precedence — like a basic calculator).
 * Each number must be used exactly once.
 *
 * Solve the puzzle → +50 pts + time bonus
 * New puzzle generated after each solve.
 * Timer counts down; game ends at 0.
 */

(function registerNumberSlide() {

  /* ── Solver: find achievable values by left-to-right evaluation ── */
  const OPS = ['+', '-', '×', '÷'];

  function calc(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? NaN : a / b;
    return NaN;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    arr.forEach((val, i) => {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      permutations(rest).forEach(p => result.push([val, ...p]));
    });
    return result;
  }

  function findSolution(nums, target) {
    // Returns a solution string or null
    for (const perm of permutations(nums)) {
      for (const op1 of OPS) for (const op2 of OPS) for (const op3 of OPS) {
        const r1 = calc(perm[0], op1, perm[1]);
        const r2 = calc(r1,      op2, perm[2]);
        const r3 = calc(r2,      op3, perm[3]);
        if (Math.abs(r3 - target) < 0.0001 && isFinite(r3)) {
          return `${perm[0]} ${op1} ${perm[1]} ${op2} ${perm[2]} ${op3} ${perm[3]}`;
        }
      }
    }
    return null;
  }

  function getAchievableTargets(nums) {
    const found = new Set();
    for (const perm of permutations(nums)) {
      for (const op1 of OPS) for (const op2 of OPS) for (const op3 of OPS) {
        const r1 = calc(perm[0], op1, perm[1]);
        const r2 = calc(r1,      op2, perm[2]);
        const r3 = calc(r2,      op3, perm[3]);
        if (isFinite(r3) && r3 > 0 && r3 === Math.floor(r3) && r3 <= 100) {
          found.add(r3);
        }
      }
    }
    return [...found];
  }

  function generatePuzzle() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const nums = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 9));
      const achievable = getAchievableTargets(nums);
      if (achievable.length === 0) continue;
      // Prefer 24 if achievable
      const target = achievable.includes(24) ? 24 : achievable[Math.floor(Math.random() * achievable.length)];
      return { nums, target };
    }
    // Fallback safe puzzle
    return { nums: [3, 8, 2, 4], target: 24 }; // 3×8=24, etc.
  }

  /* ── Game ── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = '#fdd835', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    let score = 0, timeLeft = gameDuration, isGameOver = false;
    let timerHandle = null;
    let nums = [], target = 0;
    let expr = [];        // alternating: [num, op, num, op, num, op, num]
    let usedIndices = []; // which of the 4 nums are used
    let puzzlesSolved = 0;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%;
      overflow: hidden; background:#f7f3ee; position: relative;
    `;

    // HUD
    const hud = document.createElement('div');
    hud.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.3em 0.6em; flex-shrink: 0; background: rgba(0,0,0,0.4);
    `;
    hud.innerHTML = `
      <span id="ns-score-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};">0</span>
      <span id="ns-solved-${playerIndex}" style="font-family:var(--font-body);font-size:var(--text-sm);color:#aaa;">0 solved</span>
      <span id="ns-timer-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#1a1a2e;"></span>
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

    // Target area
    const targetArea = document.createElement('div');
    targetArea.style.cssText = `
      text-align: center; padding: 0.4em 0.2em; flex-shrink: 0;
    `;
    targetArea.innerHTML = `
      <div style="font-family:var(--font-body);font-size:var(--text-sm);color:#aaa;">목표</div>
      <div id="ns-target-${playerIndex}" style="font-family:var(--font-display);font-size:clamp(2rem,8vmin,4rem);color:${playerColor};line-height:1;"></div>
    `;
    container.appendChild(targetArea);

    // Expression display
    const exprArea = document.createElement('div');
    exprArea.style.cssText = `
      text-align: center; padding: 0.3em; flex-shrink: 0; min-height: 3em;
      display: flex; align-items: center; justify-content: center; gap: 0.2em;
    `;
    const exprEl = document.createElement('div');
    exprEl.id = `ns-expr-${playerIndex}`;
    exprEl.style.cssText = `
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 4vmin, 2rem);
      color: #1a1a2e; letter-spacing: 0.05em;
      min-height: 1.5em; display: flex; align-items: center; gap: 0.3em;
    `;
    const resultEl = document.createElement('div');
    resultEl.style.cssText = `
      font-family: var(--font-display); font-size: clamp(0.9rem, 3vmin, 1.4rem);
      color: #aaa; margin-left: 0.5em;
    `;
    exprArea.appendChild(exprEl);
    exprArea.appendChild(resultEl);
    container.appendChild(exprArea);

    // Feedback message
    const feedbackEl = document.createElement('div');
    feedbackEl.style.cssText = `
      text-align:center; font-family:var(--font-display);
      font-size:clamp(1rem,3vmin,1.5rem); min-height:1.6em; flex-shrink:0;
      transition: color 0.2s;
    `;
    container.appendChild(feedbackEl);

    // Numbers row
    const numsRow = document.createElement('div');
    numsRow.style.cssText = `
      display: flex; justify-content: center; gap: clamp(0.5em,2vw,1.2em);
      padding: 0.4em; flex-shrink: 0;
    `;
    container.appendChild(numsRow);

    // Operators row
    const opsRow = document.createElement('div');
    opsRow.style.cssText = `
      display: flex; justify-content: center; gap: clamp(0.5em,2vw,1.2em);
      padding: 0.3em; flex-shrink: 0;
    `;
    container.appendChild(opsRow);

    // Action row (clear + hint)
    const actRow = document.createElement('div');
    actRow.style.cssText = `
      display: flex; justify-content: center; gap: 1em;
      padding: 0.3em 0.5em 0.5em; flex-shrink: 0;
    `;
    container.appendChild(actRow);

    /* ── Refs ── */
    const scoreEl   = container.querySelector(`#ns-score-${playerIndex}`);
    const solvedEl  = container.querySelector(`#ns-solved-${playerIndex}`);
    const timerEl   = container.querySelector(`#ns-timer-${playerIndex}`);
    const targetEl  = container.querySelector(`#ns-target-${playerIndex}`);

    /* ── Button factory ── */
    function makeTile(text, bg, onTap) {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = `
        min-width: clamp(2.8em, 10vw, 4em);
        height: clamp(2.8em, 10vw, 4em);
        border: 2px solid rgba(0,0,0,0.2);
        border-radius: 0.6em;
        background: ${bg || 'rgba(255,255,255,0.1)'};
        color: #1a1a2e;
        font-family: var(--font-display);
        font-size: clamp(1.1rem, 3.5vmin, 2rem);
        cursor: pointer; touch-action: manipulation; user-select: none;
        transition: transform 0.1s, background 0.1s;
      `;
      const fire = (e) => { e.preventDefault(); if (!isGameOver) onTap(btn); };
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('click', fire);
      return btn;
    }

    /* ── Render expression ── */
    function renderExpr() {
      exprEl.innerHTML = '';
      if (expr.length === 0) {
        exprEl.innerHTML = '<span style="color:#555;">숫자를 선택하세요</span>';
        resultEl.textContent = '';
        return;
      }
      expr.forEach((token, i) => {
        const span = document.createElement('span');
        span.textContent = token;
        span.style.color = (typeof token === 'number') ? '#fff' : '#fdd835';
        exprEl.appendChild(span);
      });

      // Show running result
      if (expr.length >= 3 && expr.length % 2 === 1) {
        let val = expr[0];
        for (let i = 1; i < expr.length - 1; i += 2) {
          val = calc(val, expr[i], expr[i + 1]);
        }
        if (isFinite(val)) {
          resultEl.textContent = `= ${Number.isInteger(val) ? val : val.toFixed(2)}`;
          resultEl.style.color = '#aaa';
        } else {
          resultEl.textContent = '= ?';
        }
      } else {
        resultEl.textContent = '';
      }
    }

    /* ── Check / submit ── */
    function checkExpr() {
      if (expr.length !== 7) return; // must be num op num op num op num
      let val = expr[0];
      for (let i = 1; i < 6; i += 2) {
        val = calc(val, expr[i], expr[i + 1]);
        if (!isFinite(val)) { showFeedback('나눗셈 오류! ÷0 불가', '#ef5350'); return; }
      }
      if (Math.abs(val - target) < 0.0001) {
        // Correct!
        const bonus = Math.max(0, timeLeft) * 2;
        score += 50 + bonus;
        window.SoundEngine?.play("correct");
        puzzlesSolved++;
        updateHUD();
        showFeedback(`🎉 정답! +${50 + bonus}점`, '#66bb6a');
        setTimeout(() => {
          if (isGameOver) return;
          loadPuzzle();
        }, 1200);
      } else {
        showFeedback(`❌ ${Number.isInteger(val) ? val : val.toFixed(2)} ≠ ${target}`, '#ef5350');
      }
    }

    function showFeedback(text, color) {
      feedbackEl.textContent  = text;
      feedbackEl.style.color  = color || '#fff';
      clearTimeout(feedbackEl._t);
      feedbackEl._t = setTimeout(() => { feedbackEl.textContent = ''; }, 1500);
    }

    /* ── Build puzzle UI ── */
    let numBtns = [];

    function loadPuzzle() {
      const puzzle = generatePuzzle();
      nums   = puzzle.nums;
      target = puzzle.target;
      expr   = [];
      usedIndices = [];
      if (targetEl) targetEl.textContent = target;
      feedbackEl.textContent = '';
      renderExpr();
      buildNumButtons();
      updateHUD();
    }

    function buildNumButtons() {
      numsRow.innerHTML = '';
      numBtns = [];
      nums.forEach((n, i) => {
        const btn = makeTile(n, 'rgba(100,150,255,0.2)', (b) => tapNumber(i, b));
        numBtns.push(btn);
        numsRow.appendChild(btn);
      });
    }

    function tapNumber(idx, btn) {
      if (usedIndices.includes(idx)) return; // already used

      // Expression must alternate: num, op, num, op...
      if (expr.length % 2 !== 0) return; // need an operator first (except at start)
      if (expr.length > 0 && expr.length % 2 === 0 && typeof expr[expr.length - 1] !== 'string') return;

      expr.push(nums[idx]);
      usedIndices.push(idx);
      btn.style.opacity = '0.3';
      btn.style.pointerEvents = 'none';
      btn.style.transform = 'scale(0.9)';

      renderExpr();
      if (expr.length === 7) checkExpr();
    }

    function tapOp(op) {
      // Need a number before an operator
      if (expr.length === 0 || expr.length % 2 === 0) return;
      if (expr.length >= 6) return; // max 3 operators in 7-token expr
      expr.push(op);
      renderExpr();
    }

    /* ── Operator buttons ── */
    OPS.forEach(op => {
      opsRow.appendChild(makeTile(op, 'rgba(253,216,53,0.15)', () => tapOp(op)));
    });

    /* ── Action buttons ── */
    const clearBtn = makeTile('↩ 지우기', 'rgba(239,83,80,0.2)', () => {
      expr = [];
      usedIndices = [];
      numBtns.forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; b.style.transform = ''; });
      renderExpr();
      feedbackEl.textContent = '';
    });
    clearBtn.style.minWidth = 'unset';
    clearBtn.style.width = 'auto';
    clearBtn.style.padding = '0 1em';
    clearBtn.style.fontSize = 'clamp(0.9rem,2.5vmin,1.3rem)';
    actRow.appendChild(clearBtn);

    const hintBtn = makeTile('💡 힌트', 'rgba(255,255,255,0.08)', () => {
      const sol = findSolution(nums, target);
      if (sol) showFeedback(`힌트: ${sol}`, '#aaa');
      else showFeedback('풀이 없음 (다음으로)', '#aaa');
      score = Math.max(0, score - 5);
      updateHUD();
    });
    hintBtn.style.minWidth = 'unset';
    hintBtn.style.width = 'auto';
    hintBtn.style.padding = '0 1em';
    hintBtn.style.fontSize = 'clamp(0.9rem,2.5vmin,1.3rem)';
    actRow.appendChild(hintBtn);

    /* ── HUD ── */
    function updateHUD() {
      if (scoreEl)     scoreEl.textContent = score;
      if (solvedEl)    solvedEl.textContent = `${puzzlesSolved} solved`;
      if (timerEl)     { timerEl.textContent = `${timeLeft}s`; timerEl.style.color = timeLeft <= 10 ? '#ff5252' : '#1a1a2e'; }
      if (timerBarFill){ timerBarFill.style.width = `${(timeLeft / gameDuration) * 100}%`; }
      timerBarFill.classList.toggle('urgent', timeLeft <= 10);
    }

    /* ── Timer ── */
    function startTimer() {
      timerHandle = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        updateHUD();
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    /* ── End ── */
    function endGame() {
      isGameOver = true;
      clearInterval(timerHandle);

      const key  = `number-slide-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));
      const isNewBest = score > best;
      const trophy = score >= 200 ? '🏆' : score >= 100 ? '🥈' : '🔢';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${puzzlesSolved}문제 해결</div>
        ${isNewBest
          ? `<div style="font-family:var(--font-body);font-size:var(--text-md);color:var(--primary);animation:bounceIn 0.5s 0.3s both;">🌟 최고 기록!</div>`
          : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최고: ${Math.max(score, best)}점</div>`
        }
      `;
      container.appendChild(overlay);
      if (typeof onGameOver === 'function') onGameOver(score);
    }

    function destroy() {
      isGameOver = true;
      clearInterval(timerHandle);
      if (container) container.innerHTML = '';
    }

    loadPuzzle();
    startTimer();
    updateHUD();
    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['number-slide'] = { init };

})();
