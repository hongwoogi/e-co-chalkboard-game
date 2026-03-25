'use strict';
/**
 * games/word-quiz/game.js
 * "낱말 퀴즈" — Word Quiz mini-game
 *
 * Show a Korean word with one syllable replaced by "❓".
 * Player taps the correct missing syllable from 4 options.
 *
 * Word bank: 22 common Korean words with emoji pairs.
 * +10 correct, -5 wrong, 800ms delay before next.
 */

(function registerWordQuiz() {

  /* ── Word bank ──────────────────────────────────────── */
  const WORD_BANK = [
    { word: '바나나', emoji: '🍌' },
    { word: '사과',   emoji: '🍎' },
    { word: '포도',   emoji: '🍇' },
    { word: '딸기',   emoji: '🍓' },
    { word: '수박',   emoji: '🍉' },
    { word: '고양이', emoji: '🐱' },
    { word: '강아지', emoji: '🐶' },
    { word: '토끼',   emoji: '🐰' },
    { word: '코끼리', emoji: '🐘' },
    { word: '사자',   emoji: '🦁' },
    { word: '자동차', emoji: '🚗' },
    { word: '비행기', emoji: '✈️' },
    { word: '기차',   emoji: '🚂' },
    { word: '배',     emoji: '🚢' },
    { word: '로켓',   emoji: '🚀' },
    { word: '피자',   emoji: '🍕' },
    { word: '햄버거', emoji: '🍔' },
    { word: '아이스크림', emoji: '🍦' },
    { word: '케이크', emoji: '🎂' },
    { word: '초콜릿', emoji: '🍫' },
    { word: '학교',   emoji: '🏫' },
    { word: '책',     emoji: '📚' },
  ];

  const POINTS_CORRECT   = 10;
  const POINTS_WRONG     = 5;
  const NEXT_ROUND_DELAY = 800;

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
    let isWaiting     = false;
    let timerInterval = null;
    let roundTimeout  = null;
    let correctSyl    = '';   // correct missing syllable

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
        <div class="score-chip"><span class="score-icon">⭐</span><span id="wq-score-${playerIndex}">0</span>점</div>
        <div style="display:flex;align-items:center;gap:var(--space-xs);">
          <span>⏱</span>
          <div class="timer-digit" id="wq-timer-${playerIndex}">${gameDuration}</div>
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
      instrEl.textContent = '❓ 자리에 들어갈 글자를 맞춰봐요! 📚';

      /* Word display area */
      const wordSection = document.createElement('div');
      wordSection.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        gap: clamp(0.4rem, 1.5vh, 1rem);
        padding: var(--space-sm);
      `;

      // Emoji
      const emojiEl = document.createElement('div');
      emojiEl.id = `wq-emoji-${playerIndex}`;
      emojiEl.style.cssText = `
        font-size: clamp(2.5rem, 8vw, 5rem);
        line-height: 1;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
        animation: bounceIn 0.4s both;
      `;
      emojiEl.textContent = '❓';

      // Word with hole
      const wordEl = document.createElement('div');
      wordEl.id = `wq-word-${playerIndex}`;
      wordEl.style.cssText = `
        font-family: var(--font-display);
        font-size: clamp(1.8rem, 7vw, 4.5rem);
        color: var(--on-surface);
        text-align: center;
        letter-spacing: 0.12em;
        background: var(--surface-container-high);
        padding: var(--space-xs) var(--space-lg);
        border-radius: var(--radius-xl);
        border: 2px solid var(--outline-variant);
        box-shadow: inset 0 2px 8px rgba(0,0,0,0.2);
      `;
      wordEl.textContent = '...';

      wordSection.appendChild(emojiEl);
      wordSection.appendChild(wordEl);

      /* Feedback */
      const feedbackEl = document.createElement('div');
      feedbackEl.id = `wq-feedback-${playerIndex}`;
      feedbackEl.style.cssText = `
        text-align: center;
        font-size: var(--text-md);
        font-family: var(--font-display);
        min-height: 2em;
        flex-shrink: 0;
      `;

      /* Answer buttons: 2x2 grid */
      const btnGrid = document.createElement('div');
      btnGrid.id = `wq-btns-${playerIndex}`;
      btnGrid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: clamp(0.4rem, 1.2vw, 0.8rem);
        padding: var(--space-xs) var(--space-sm) var(--space-sm);
        flex-shrink: 0;
      `;

      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(instrEl);
      container.appendChild(wordSection);
      container.appendChild(feedbackEl);
      container.appendChild(btnGrid);

      /* Cache refs */
      dom.scoreEl    = container.querySelector(`#wq-score-${playerIndex}`);
      dom.timerDigit = container.querySelector(`#wq-timer-${playerIndex}`);
      dom.timerBar   = timerBarFill;
      dom.emojiEl    = container.querySelector(`#wq-emoji-${playerIndex}`);
      dom.wordEl     = container.querySelector(`#wq-word-${playerIndex}`);
      dom.feedbackEl = container.querySelector(`#wq-feedback-${playerIndex}`);
      dom.btnGrid    = container.querySelector(`#wq-btns-${playerIndex}`);

      startGame();
    }

    /* ─────────────────────────────────────
       GAME LOGIC
    ───────────────────────────────────── */
    function startGame() {
      score      = 0;
      timeLeft   = gameDuration;
      isGameOver = false;
      isWaiting  = false;
      updateScoreUI();
      updateTimerUI();
      nextRound();
      startTimer();
    }

    /** Split a Korean word into individual syllables (each char). */
    function syllables(word) {
      return [...word]; // spread handles multi-byte Korean chars
    }

    function nextRound() {
      if (isGameOver) return;
      isWaiting = false;

      // Pick a random word
      const entry = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
      const syls  = syllables(entry.word);

      // Pick a random syllable index to hide
      const hiddenIdx = Math.floor(Math.random() * syls.length);
      correctSyl = syls[hiddenIdx];

      // Build display with ❓ replacing the hidden syllable
      const displayParts = syls.map((s, i) => {
        if (i === hiddenIdx) {
          return `<span style="color:var(--secondary);font-size:1.1em;">❓</span>`;
        }
        return `<span>${s}</span>`;
      });

      // Animate
      dom.emojiEl.style.animation = 'none';
      void dom.emojiEl.offsetWidth;
      dom.emojiEl.style.animation = 'bounceIn 0.4s both';
      dom.emojiEl.textContent = entry.emoji;

      dom.wordEl.innerHTML = displayParts.join(
        `<span style="opacity:0.3; font-size:0.7em; margin:0 0.05em;">·</span>`
      );

      dom.feedbackEl.textContent = '';

      // Build 4 choice buttons: correct + 3 wrong from other word syllables
      const wrongPool = new Set();
      let attempts = 0;
      while (wrongPool.size < 3 && attempts < 200) {
        attempts++;
        const rEntry = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
        const rSyls  = syllables(rEntry.word);
        const rSyl   = rSyls[Math.floor(Math.random() * rSyls.length)];
        if (rSyl !== correctSyl) wrongPool.add(rSyl);
      }

      const choices = [correctSyl, ...[...wrongPool].slice(0, 3)];
      shuffle(choices);

      dom.btnGrid.innerHTML = '';
      const COLORS = ['#fdd34d', '#fd8863', '#7ed3ff', '#c084fc'];
      choices.forEach((syl, i) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          padding: clamp(0.6rem, 2vh, 1.2rem) var(--space-sm);
          border-radius: var(--radius-lg);
          border: 2px solid ${COLORS[i]}44;
          background: color-mix(in srgb, ${COLORS[i]} 40%, #f0ece5);
          color: var(--on-surface);
          font-family: var(--font-display);
          font-size: clamp(1.3rem, 4.5vw, 2.5rem);
          cursor: pointer;
          touch-action: manipulation;
          transition: transform 0.1s, filter 0.1s;
          box-shadow: 0 0 12px 2px ${COLORS[i]}22;
        `;
        btn.textContent = syl;

        const onTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isWaiting || isGameOver) return;
          handleChoice(syl === correctSyl, btn);
        };
        btn.addEventListener('touchend', onTap, { passive: false });
        btn.addEventListener('click', onTap);
        dom.btnGrid.appendChild(btn);
      });
    }

    function handleChoice(correct, btn) {
      isWaiting = true;

      if (correct) {
        score += POINTS_CORRECT;
        window.SoundEngine?.play("correct");
        btn.style.filter    = 'brightness(1.4)';
        btn.style.transform = 'scale(1.1)';
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-correct);">✅ 정답! +${POINTS_CORRECT}</span>`;
        // Replace ❓ with the correct syllable highlight
        const spans = dom.wordEl.querySelectorAll('span');
        spans.forEach(s => {
          if (s.textContent === '❓') {
            s.textContent = correctSyl;
            s.style.color = 'var(--color-correct)';
          }
        });
      } else {
        score = Math.max(0, score - POINTS_WRONG);
        window.SoundEngine?.play("wrong");
        btn.style.filter    = 'brightness(0.6)';
        btn.style.animation = 'shake 0.4s ease-out';
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-wrong);">❌ 틀렸어요! -${POINTS_WRONG}</span>`;
      }

      updateScoreUI();
      dom.btnGrid.querySelectorAll('button').forEach(b => b.style.pointerEvents = 'none');

      roundTimeout = setTimeout(() => {
        nextRound();
      }, NEXT_ROUND_DELAY);
    }

    /* ── Timer ── */
    function startTimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timeLeft--;
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
      isWaiting  = true;
      clearTimeout(roundTimeout);

      const key  = `word-quiz-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));

      const trophy    = score >= 120 ? '🏆' : score >= 60 ? '🥈' : '📚';
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
      clearInterval(timerInterval);
      clearTimeout(roundTimeout);
      isGameOver = true;
      if (container) container.innerHTML = '';
      dom = {};
    }

    buildUI();
    return { destroy };
  }

  /* ── Helpers ── */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ── Register ── */
  window.GameModules = window.GameModules || {};
  window.GameModules['word-quiz'] = { init };

})();
