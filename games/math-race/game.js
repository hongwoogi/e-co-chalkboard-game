'use strict';
/**
 * games/math-race/game.js
 * "수학 레이스" — Math Race mini-game
 *
 * A math question appears. Tap the correct answer from 3 options.
 * Each correct answer moves a 🚀 rocket forward on a track.
 * Reach the finish line (10 correct) to win!
 *
 * Difficulty scales with progress: addition → subtraction → multiplication.
 * Timer counts down; if time runs out before finish = lose.
 */

(function registerMathRace() {

  const FINISH_LINE   = 10;   // correct answers needed to win
  const POINTS_RIGHT  = 10;
  const WRONG_DELAY   = 500;  // ms to shake before re-enabling

  /* ─────────────────────────────────────────────────────
     init()
  ───────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score         = 0;
    let progress      = 0;   // correct answers so far (0–10)
    let timeLeft      = gameDuration;
    let isGameOver    = false;
    let isAnswering   = false;
    let timerInterval = null;
    let nextTimeout   = null;
    let currentAnswer = null;

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

      /* Top bar: score + timer */
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
        <div class="score-chip"><span class="score-icon">⭐</span><span id="mr-score-${playerIndex}">0</span>점</div>
        <div style="display:flex;align-items:center;gap:var(--space-xs);">
          <span>⏱</span>
          <div class="timer-digit" id="mr-timer-${playerIndex}">${gameDuration}</div>
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

      /* Race track */
      const trackWrap = document.createElement('div');
      trackWrap.style.cssText = `
        padding: var(--space-xs) var(--space-sm);
        flex-shrink: 0;
        background: var(--surface-container-high);
      `;

      // Track label
      const trackLabel = document.createElement('div');
      trackLabel.style.cssText = `
        font-size: var(--text-xs);
        color: var(--on-surface-variant);
        font-family: var(--font-body);
        margin-bottom: 4px;
        text-align: center;
      `;
      trackLabel.innerHTML = `<span id="mr-progress-${playerIndex}">0</span> / ${FINISH_LINE} 🏁`;

      // Track bar
      const trackBg = document.createElement('div');
      trackBg.style.cssText = `
        position: relative;
        height: clamp(2.5rem, 6vh, 4rem);
        background: var(--surface-variant);
        border-radius: var(--radius-full);
        overflow: visible;
        display: flex;
        align-items: center;
      `;

      // Dashed lanes
      const laneDash = document.createElement('div');
      laneDash.style.cssText = `
        position: absolute;
        inset: 48% 2% auto 2%;
        height: 2px;
        background: repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 12px, transparent 12px, transparent 24px);
        border-radius: 2px;
      `;

      // Finish flag
      const finishFlag = document.createElement('div');
      finishFlag.style.cssText = `
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: clamp(1.2rem, 3vw, 2rem);
        z-index: 2;
      `;
      finishFlag.textContent = '🏁';

      // Rocket emoji
      const rocket = document.createElement('div');
      rocket.id = `mr-rocket-${playerIndex}`;
      rocket.style.cssText = `
        position: absolute;
        left: 2%;
        top: 50%;
        transform: translateY(-50%);
        font-size: clamp(1.4rem, 3.5vw, 2.4rem);
        transition: left 0.5s cubic-bezier(0.34,1.56,0.64,1);
        z-index: 3;
        filter: drop-shadow(0 0 8px rgba(255,220,50,0.7));
      `;
      rocket.textContent = '🚀';

      trackBg.appendChild(laneDash);
      trackBg.appendChild(finishFlag);
      trackBg.appendChild(rocket);
      trackWrap.appendChild(trackLabel);
      trackWrap.appendChild(trackBg);

      /* Question area */
      const questionWrap = document.createElement('div');
      questionWrap.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-sm);
        flex-shrink: 0;
      `;
      const questionBox = document.createElement('div');
      questionBox.className = 'question-display';
      questionBox.style.width = '100%';
      const questionText = document.createElement('div');
      questionText.className = 'question-text';
      questionText.id = `mr-question-${playerIndex}`;
      questionText.textContent = '...';
      questionBox.appendChild(questionText);
      questionWrap.appendChild(questionBox);

      /* Answer buttons */
      const answerArea = document.createElement('div');
      answerArea.id = `mr-answers-${playerIndex}`;
      answerArea.style.cssText = `
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: clamp(0.4rem, 1.5vw, 0.8rem);
        padding: var(--space-xs) var(--space-sm) var(--space-sm);
        flex: 1;
      `;

      /* Feedback */
      const feedbackEl = document.createElement('div');
      feedbackEl.id = `mr-feedback-${playerIndex}`;
      feedbackEl.style.cssText = `
        text-align: center;
        font-size: var(--text-md);
        font-family: var(--font-display);
        min-height: 2em;
        flex-shrink: 0;
        padding: 0 var(--space-sm);
      `;

      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(trackWrap);
      container.appendChild(questionWrap);
      container.appendChild(answerArea);
      container.appendChild(feedbackEl);

      /* Cache refs */
      dom.scoreEl      = container.querySelector(`#mr-score-${playerIndex}`);
      dom.timerDigit   = container.querySelector(`#mr-timer-${playerIndex}`);
      dom.timerBar     = timerBarFill;
      dom.progressEl   = container.querySelector(`#mr-progress-${playerIndex}`);
      dom.rocket       = container.querySelector(`#mr-rocket-${playerIndex}`);
      dom.questionText = container.querySelector(`#mr-question-${playerIndex}`);
      dom.answerArea   = container.querySelector(`#mr-answers-${playerIndex}`);
      dom.feedbackEl   = container.querySelector(`#mr-feedback-${playerIndex}`);

      startGame();
    }

    /* ─────────────────────────────────────
       GAME LOGIC
    ───────────────────────────────────── */
    function startGame() {
      score       = 0;
      progress    = 0;
      timeLeft    = gameDuration;
      isGameOver  = false;
      isAnswering = false;
      updateScoreUI();
      updateTimerUI();
      updateTrack();
      nextQuestion();
      startTimer();
    }

    /** Generate question based on current progress (difficulty). */
    function generateQuestion() {
      const scope = window.GradeScope?.get(
        window._gameSettings?.grade,
        window._gameSettings?.semester
      );

      let a, b, answer, questionStr, op;

      if (scope) {
        // Grade-scope mode
        op = scope.ops[Math.floor(Math.random() * scope.ops.length)];
        const cap = Math.min(scope.maxNum, 30);
        if (op === '+') {
          a = randInt(1, cap); b = randInt(1, cap);
          answer = a + b; questionStr = `${a} + ${b} = ?`;
        } else if (op === '-') {
          a = randInt(2, cap + 5); b = randInt(1, Math.max(1, a - 1));
          answer = a - b; questionStr = `${a} - ${b} = ?`;
        } else if (op === '×') {
          a = randInt(2, 9); b = randInt(2, 9);
          answer = a * b; questionStr = `${a} × ${b} = ?`;
        } else { // ÷
          b = randInt(2, 9); a = b * randInt(2, 9);
          answer = a / b; questionStr = `${a} ÷ ${b} = ?`;
        }
      } else {
        // Auto mode: scale with progress
        const p = progress;
        if (p < 3) {
          op = '+';
          a = randInt(1, 10); b = randInt(1, 10);
          answer = a + b; questionStr = `${a} + ${b} = ?`;
        } else if (p < 6) {
          op = Math.random() < 0.5 ? '+' : '-';
          if (op === '+') {
            a = randInt(5, 20); b = randInt(1, 15);
            answer = a + b; questionStr = `${a} + ${b} = ?`;
          } else {
            a = randInt(10, 25); b = randInt(1, a);
            answer = a - b; questionStr = `${a} - ${b} = ?`;
          }
        } else {
          a = randInt(2, 9); b = randInt(2, 9);
          answer = a * b; questionStr = `${a} × ${b} = ?`;
        }
      }

      // 3 wrong answers
      const wrongs = new Set();
      while (wrongs.size < 2) {
        let w = answer + randInt(-9, 9);
        if (w !== answer && w >= 0 && !wrongs.has(w)) wrongs.add(w);
      }

      const choices = [answer, ...[...wrongs]];
      shuffle(choices);
      return { questionStr, answer, choices };
    }

    function nextQuestion() {
      if (isGameOver) return;
      isAnswering = true;
      const { questionStr, answer, choices } = generateQuestion();
      currentAnswer = answer;

      dom.questionText.textContent = questionStr;
      dom.questionText.style.animation = 'none';
      void dom.questionText.offsetWidth;
      dom.questionText.style.animation = 'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
      dom.feedbackEl.textContent = '';

      // Render 3 answer buttons
      dom.answerArea.innerHTML = '';
      const COLORS = ['#fdd34d', '#fd8863', '#7ed3ff'];
      choices.forEach((val, i) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          flex: 1;
          padding: clamp(0.5rem, 1.5vh, 1rem) var(--space-sm);
          border-radius: var(--radius-lg);
          border: 2px solid ${COLORS[i]}55;
          background: color-mix(in srgb, ${COLORS[i]} 18%, var(--surface-container-high));
          color: var(--on-surface);
          font-family: var(--font-display);
          font-size: clamp(1.2rem, 4vw, 2.2rem);
          cursor: pointer;
          touch-action: manipulation;
          transition: transform 0.1s, filter 0.1s;
          box-shadow: 0 0 16px 2px ${COLORS[i]}22;
        `;
        btn.textContent = val;

        const onTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isAnswering || isGameOver) return;
          handleAnswer(val === answer, btn, val);
        };
        btn.addEventListener('touchend', onTap, { passive: false });
        btn.addEventListener('click', onTap);

        dom.answerArea.appendChild(btn);
      });
    }

    function handleAnswer(correct, btn, val) {
      isAnswering = false;
      // Disable all buttons
      dom.answerArea.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');

      if (correct) {
        score    += POINTS_RIGHT;
        progress  = Math.min(progress + 1, FINISH_LINE);
        btn.style.filter    = 'brightness(1.4)';
        btn.style.transform = 'scale(1.1)';
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-correct);">✅ 정답! +${POINTS_RIGHT}</span>`;
        updateScoreUI();
        updateTrack();

        if (progress >= FINISH_LINE) {
          // WIN!
          clearInterval(timerInterval);
          nextTimeout = setTimeout(() => triggerGameOver(true), 800);
        } else {
          nextTimeout = setTimeout(nextQuestion, 600);
        }
      } else {
        btn.style.filter    = 'brightness(0.6)';
        btn.style.animation = 'shake 0.4s ease-out';
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-wrong);">❌ 다시 시도!</span>`;
        nextTimeout = setTimeout(() => {
          isAnswering = true;
          btn.style.animation = '';
          btn.style.filter    = '';
          dom.answerArea.querySelectorAll('button').forEach(b => b.style.pointerEvents = '');
          dom.feedbackEl.textContent = '';
        }, WRONG_DELAY);
      }
    }

    function updateTrack() {
      if (!dom.rocket || !dom.progressEl) return;
      dom.progressEl.textContent = progress;
      // Move rocket: left goes from ~2% (start) to ~80% (near finish)
      const pct = (progress / FINISH_LINE) * 78 + 2;
      dom.rocket.style.left = `${pct}%`;
    }

    /* ── Timer ── */
    function startTimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          triggerGameOver(false);
        }
      }, 1000);
    }

    /* ── Game Over ── */
    function triggerGameOver(win) {
      isGameOver  = true;
      isAnswering = false;
      clearTimeout(nextTimeout);

      const key  = `math-race-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));

      const timeBonus = win ? timeLeft * 2 : 0;
      if (win) score += timeBonus;

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';

      const title = win ? '🏆 완주!' : '😭 시간 초과!';
      const isNewBest = score > best;

      overlay.innerHTML = `
        <div class="game-over-title" style="color:${win ? 'var(--primary)' : 'var(--color-wrong)'};">${title}</div>
        ${win
          ? `<div style="font-family:var(--font-display);font-size:var(--text-xl);animation:bounceIn 0.5s both;">🚀 결승선 통과! +${timeBonus} 시간 보너스!</div>`
          : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${progress}/${FINISH_LINE} 완료</div>`
        }
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
      clearInterval(timerInterval);
      clearTimeout(nextTimeout);
      isGameOver = true;
      if (container) container.innerHTML = '';
      dom = {};
    }

    buildUI();
    return { destroy };
  }

  /* ── Helpers ── */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Register ── */
  window.GameModules = window.GameModules || {};
  window.GameModules['math-race'] = { init };

})();
