/**
 * games/number-pop/game.js
 * "숫자 팡팡" — Number Pop mini-game
 *
 * Gameplay:
 *  - A math question appears at the top of the panel.
 *  - 4 bubble buttons float up from the bottom.
 *    One has the correct answer; three have wrong answers.
 *  - Tap the correct bubble → +10 points, pop animation.
 *  - Tap a wrong bubble    → shake animation, -5 points.
 *  - 60-second countdown timer.
 *  - Difficulty (number range, operator mix) increases over time.
 *  - Final score is saved to localStorage.
 *
 * Architecture:
 *  - Registers itself at window.GameModules['number-pop'].
 *  - Exports an `init(container, options)` function that returns
 *    a game instance with a `destroy()` method.
 *  - All DOM is created inside `container`; no global DOM pollution.
 *  - Uses CSS custom properties from the host page's design system.
 */

'use strict';

(function registerNumberPop() {

  /* ── Game constants ───────────────────────── */
  const GAME_DURATION_SECONDS = 60;
  const POINTS_CORRECT        = 10;
  const POINTS_WRONG          = 5;
  const BUBBLE_COUNT          = 4;     // always 4 bubbles per question
  const NEXT_QUESTION_DELAY   = 700;   // ms after correct tap before next question

  /* ── Difficulty tiers ──────────────────────
     Tiers scale with elapsed time.
     Each tier defines:
       range    — answer will be in [min, max]
       ops      — allowed operators
       label    — display label
  ──────────────────────────────────────────── */
  const DIFFICULTY_TIERS = [
    { timeThreshold: 0,  range: [1, 10],  ops: ['+'],        label: '쉬움 😊' },
    { timeThreshold: 15, range: [1, 20],  ops: ['+', '-'],   label: '보통 🙂' },
    { timeThreshold: 30, range: [1, 30],  ops: ['+', '-'],   label: '어려움 😤' },
    { timeThreshold: 45, range: [2, 12],  ops: ['+', '-', '×'], label: '최고 🔥' },
  ];

  /* ── Bubble colour palette ─────────────────
     Cycles through these for visual variety.
  ──────────────────────────────────────────── */
  const BUBBLE_COLORS = [
    '#fdd34d',  // gold
    '#fd8863',  // coral
    '#7ed3ff',  // sky blue
    '#c084fc',  // purple
    '#4ade80',  // green
    '#f472b6',  // pink
  ];

  /* ─────────────────────────────────────────────
     init()
     Entry point called by LayoutManager.
     Returns a game instance { destroy }.
  ───────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};

    /* ── Duration from global settings (set by host page) ── */
    const gameDuration = (window._gameSettings && window._gameSettings.duration)
      ? window._gameSettings.duration
      : GAME_DURATION_SECONDS;

    /* ── State ─────────────────────────────── */
    let score             = 0;
    let timeLeft          = gameDuration;
    let isGameOver        = false;
    let currentAnswer     = null;
    let timerInterval     = null;
    let questionTimeout   = null;
    let animFrameId       = null;
    let bubbleColorOffset = playerIndex; // so each player gets different starting color

    /* ── DOM refs ──────────────────────────── */
    let dom = {};

    /* ─────────────────────────────────────────
       BUILD THE GAME UI
    ───────────────────────────────────────────*/
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

      // ── Top bar: score + timer ─────────────
      const topBar = el('div', {
        style: `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-xs) var(--space-sm);
          gap: var(--space-sm);
          flex-shrink: 0;
          background: var(--surface-container);
        `
      });

      // Score chip
      const scoreChip = el('div', { className: 'score-chip' });
      scoreChip.innerHTML = `<span class="score-icon">⭐</span><span class="score-value">0</span>점`;
      dom.scoreValue = scoreChip.querySelector('.score-value');

      // Difficulty pill
      const diffPill = el('div', { className: 'difficulty-pill' });
      dom.diffPill = diffPill;

      // Timer
      const timerWrap = el('div', {
        style: 'display:flex; align-items:center; gap:var(--space-xs);'
      });
      const timerIcon  = el('span', {}, '⏱');
      const timerDigit = el('div', { className: 'timer-digit' }, `${gameDuration}`);
      dom.timerDigit = timerDigit;

      timerWrap.appendChild(timerIcon);
      timerWrap.appendChild(timerDigit);

      topBar.appendChild(scoreChip);
      topBar.appendChild(diffPill);
      topBar.appendChild(timerWrap);

      // ── Timer progress bar ─────────────────
      const timerBarWrap = el('div', { className: 'timer-bar-wrapper', style: 'flex-shrink:0;' });
      const timerBarFill = el('div', { className: 'timer-bar-fill', style: 'width:100%;' });
      timerBarWrap.appendChild(timerBarFill);
      dom.timerBarFill = timerBarFill;

      // ── Question display ───────────────────
      const questionWrap = el('div', {
        style: `
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-sm);
          flex-shrink: 0;
        `
      });
      const questionDisplay = el('div', { className: 'question-display' });
      const questionText    = el('div', { className: 'question-text' }, '?');
      dom.questionText = questionText;
      questionDisplay.appendChild(questionText);
      questionWrap.appendChild(questionDisplay);

      // ── Bubble arena ───────────────────────
      const arena = el('div', {
        style: `
          position: relative;
          flex: 1;
          overflow: hidden;
          min-height: 0;
        `
      });
      dom.arena = arena;

      // Assemble
      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(questionWrap);
      container.appendChild(arena);

      // Kick off
      startGame();
    }

    /* ─────────────────────────────────────────
       GAME LOGIC
    ───────────────────────────────────────────*/

    function startGame() {
      score     = 0;
      timeLeft  = gameDuration;
      isGameOver = false;
      updateScoreUI();
      updateDifficultyUI();
      spawnQuestion();
      startTimer();
    }

    /** Determine which difficulty tier applies given elapsed time. */
    function getCurrentTier() {
      const elapsed = gameDuration - timeLeft;
      let tier = DIFFICULTY_TIERS[0];
      for (const t of DIFFICULTY_TIERS) {
        if (elapsed >= t.timeThreshold) tier = t;
      }
      return tier;
    }

    /** Generate a question and 4 bubble values. */
    function generateQuestion() {
      const tier = getCurrentTier();
      const op   = tier.ops[Math.floor(Math.random() * tier.ops.length)];
      const [min, max] = tier.range;

      let a, b, answer, questionStr;

      if (op === '+') {
        a = randInt(min, max);
        b = randInt(min, max);
        answer = a + b;
        questionStr = `${a} + ${b} = ?`;
      } else if (op === '-') {
        // Ensure answer is always positive
        a = randInt(min + 5, max + 5);
        b = randInt(min, a);
        answer = a - b;
        questionStr = `${a} - ${b} = ?`;
      } else if (op === '×') {
        a = randInt(2, 9);
        b = randInt(2, 9);
        answer = a * b;
        questionStr = `${a} × ${b} = ?`;
      }

      // Generate 3 wrong answers (distinct from correct, distinct from each other)
      const wrongs = new Set();
      while (wrongs.size < BUBBLE_COUNT - 1) {
        let w = answer + randInt(-8, 8);
        if (w !== answer && w >= 0 && !wrongs.has(w)) {
          wrongs.add(w);
        }
      }

      const allValues = [answer, ...wrongs];
      shuffle(allValues);

      return { questionStr, answer, values: allValues };
    }

    /** Render a new question and its bubbles. */
    function spawnQuestion() {
      if (isGameOver) return;

      const { questionStr, answer, values } = generateQuestion();
      currentAnswer = answer;

      // Update question text
      dom.questionText.textContent = questionStr;
      dom.questionText.style.animation = 'none';
      void dom.questionText.offsetWidth;  // reflow
      dom.questionText.style.animation = 'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';

      // Clear existing bubbles
      dom.arena.innerHTML = '';

      // Get arena dimensions
      const arenaW = dom.arena.clientWidth  || 300;
      const arenaH = dom.arena.clientHeight || 200;

      // Spawn bubbles at staggered positions
      const bubbleSize = Math.min(arenaW * 0.22, arenaH * 0.38, 100);

      values.forEach((val, i) => {
        spawnBubble(val, val === answer, i, arenaW, arenaH, bubbleSize);
      });

      updateDifficultyUI();
    }

    /**
     * Create and animate a single bubble.
     * @param {number}  value      — the number to display
     * @param {boolean} isCorrect  — is this the right answer?
     * @param {number}  slotIndex  — 0–3, used for horizontal position
     * @param {number}  arenaW
     * @param {number}  arenaH
     * @param {number}  bubbleSize — pixel diameter
     */
    function spawnBubble(value, isCorrect, slotIndex, arenaW, arenaH, bubbleSize) {
      const bubble = el('div', { className: 'bubble' });

      // Assign a colour from the palette
      const color = BUBBLE_COLORS[(bubbleColorOffset + slotIndex) % BUBBLE_COLORS.length];
      bubble.style.setProperty('--bubble-color', color);

      // Size
      bubble.style.width  = `${bubbleSize}px`;
      bubble.style.height = `${bubbleSize}px`;
      bubble.style.fontSize = `${Math.round(bubbleSize * 0.35)}px`;

      // Horizontal position — divide arena into 4 slots with a little randomness
      const slotW   = arenaW / BUBBLE_COUNT;
      const centreX = slotW * slotIndex + slotW / 2;
      const jitter  = (Math.random() - 0.5) * slotW * 0.35;
      const left    = Math.max(bubbleSize / 2, Math.min(arenaW - bubbleSize / 2, centreX + jitter));
      bubble.style.left = `${left - bubbleSize / 2}px`;

      // Vertical position — scatter across middle 60% of arena height
      const topMin  = arenaH * 0.1;
      const topMax  = arenaH * 0.7 - bubbleSize;
      const top     = topMin + Math.random() * Math.max(0, topMax - topMin);
      bubble.style.top = `${top}px`;

      bubble.textContent = value;

      // Float-up entrance animation (staggered)
      bubble.style.animation = `floatUp 0.55s cubic-bezier(0.34,1.56,0.64,1) ${slotIndex * 80}ms both`;

      // Tap handlers
      const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleBubbleTap(bubble, value, isCorrect, left, top + bubbleSize / 2);
      };

      bubble.addEventListener('touchend', onTap, { passive: false });
      bubble.addEventListener('click',    onTap);

      dom.arena.appendChild(bubble);
    }

    /**
     * Process a bubble tap.
     */
    function handleBubbleTap(bubble, value, isCorrect, x, y) {
      if (isGameOver) return;

      // Remove handlers to prevent double-tap
      const newBubble = bubble.cloneNode(true);
      bubble.parentNode.replaceChild(newBubble, bubble);

      if (isCorrect) {
        score += POINTS_CORRECT;
        window.SoundEngine?.play("correct");
        bubbleColorOffset += 2;   // shift colours for next question
        showScoreDelta(`+${POINTS_CORRECT}`, true, x, y);
        newBubble.classList.add('pop-correct');
        updateScoreUI();

        // Disable all other bubbles while celebrating
        dom.arena.querySelectorAll('.bubble').forEach(b => {
          if (b !== newBubble) {
            b.style.pointerEvents = 'none';
            b.style.opacity = '0.4';
          }
        });

        questionTimeout = setTimeout(spawnQuestion, NEXT_QUESTION_DELAY);
      } else {
        score = Math.max(0, score - POINTS_WRONG);
        window.SoundEngine?.play("wrong");
        showScoreDelta(`-${POINTS_WRONG}`, false, x, y);
        newBubble.classList.add('shake-wrong');
        updateScoreUI();

        // Re-enable tapping after shake
        setTimeout(() => {
          if (newBubble.parentNode) {
            newBubble.classList.remove('shake-wrong');
            newBubble.addEventListener('touchend', (e) => {
              e.preventDefault();
              handleBubbleTap(newBubble, value, false, x, y);
            }, { passive: false });
            newBubble.addEventListener('click', (e) => {
              handleBubbleTap(newBubble, value, false, x, y);
            });
          }
        }, 500);
      }
    }

    /** Spawn a floating "+10" or "-5" delta label. */
    function showScoreDelta(text, isPositive, x, y) {
      const delta = el('div', {
        className: `score-delta ${isPositive ? 'positive' : 'negative'}`,
        style: `left: ${x}px; top: ${y}px;`
      }, text);

      dom.arena.appendChild(delta);
      delta.addEventListener('animationend', () => delta.remove());
    }

    /* ─────────────────────────────────────────
       TIMER
    ───────────────────────────────────────────*/

    function startTimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(tick, 1000);
    }

    function tick() {
      timeLeft--;
      updateTimerUI();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        triggerGameOver();
      }
    }

    /* ─────────────────────────────────────────
       GAME OVER
    ───────────────────────────────────────────*/

    function triggerGameOver() {
      isGameOver = true;
      clearTimeout(questionTimeout);

      // Save score to localStorage
      const key = `number-pop-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) {
        localStorage.setItem(key, String(score));
      }

      // Show overlay
      const overlay = el('div', { className: 'game-over-overlay' });

      const isNewBest = score > best;
      const trophy = score >= 100 ? '🏆' : score >= 50 ? '🥈' : '🎯';

      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em; color:var(--on-surface-variant)">점</span></div>
        ${isNewBest ? `<div style="font-family:var(--font-body);font-size:var(--text-md);color:var(--primary);animation:bounceIn 0.5s 0.3s both;">🌟 최고 기록!</div>` : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최고: ${Math.max(score, best)}점</div>`}
      `;

      container.appendChild(overlay);

      if (typeof onGameOver === 'function') {
        onGameOver(score);
      }
    }

    /* ─────────────────────────────────────────
       UI UPDATES
    ───────────────────────────────────────────*/

    function updateScoreUI() {
      if (dom.scoreValue) dom.scoreValue.textContent = score;
    }

    function updateTimerUI() {
      if (!dom.timerDigit || !dom.timerBarFill) return;

      dom.timerDigit.textContent = timeLeft;

      const pct = (timeLeft / gameDuration) * 100;
      dom.timerBarFill.style.width = `${pct}%`;

      const urgent = timeLeft <= 10;
      dom.timerDigit.classList.toggle('urgent', urgent);
      dom.timerBarFill.classList.toggle('urgent', urgent);

      // Pulse the digit on each tick
      dom.timerDigit.style.animation = 'none';
      void dom.timerDigit.offsetWidth;
      dom.timerDigit.style.animation = 'timerPulse 0.3s ease-out';
    }

    function updateDifficultyUI() {
      if (!dom.diffPill) return;
      dom.diffPill.textContent = getCurrentTier().label;
    }

    /* ─────────────────────────────────────────
       CLEANUP / DESTROY
    ───────────────────────────────────────────*/

    function destroy() {
      clearInterval(timerInterval);
      clearTimeout(questionTimeout);
      cancelAnimationFrame(animFrameId);
      if (container) container.innerHTML = '';
      dom = {};
      isGameOver = true;
    }

    /* ── Kick off ────────────────────────────── */
    buildUI();

    return { destroy };
  }  // end init()

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  /** Create an element with optional attributes and text content. */
  function el(tag, attrs = {}, text = '') {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v);
    });
    if (text) e.textContent = text;
    return e;
  }

  /** Inclusive random integer in [min, max]. */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** In-place Fisher-Yates shuffle. */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Module registration ─────────────────── */
  window.GameModules = window.GameModules || {};
  window.GameModules['number-pop'] = { init };

})();
