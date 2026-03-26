'use strict';
/**
 * games/color-match/game.js
 * "잉크 색깔" — Stroop Effect
 *
 * A color word appears (e.g. "빨강") written in a DIFFERENT ink color.
 * Player must tap the button matching the INK COLOR (not the word).
 * Classic Stroop effect — tests focus and color perception!
 *
 * +10 correct, -5 wrong, 700ms delay before next question.
 */

(function registerColorMatch() {

  const COLORS = [
    { name: '빨강', hex: '#ff5555' },
    { name: '파랑', hex: '#5599ff' },
    { name: '초록', hex: '#55cc77' },
    { name: '노랑', hex: '#fdd34d' },
    { name: '보라', hex: '#c084fc' },
    { name: '주황', hex: '#fd8863' },
  ];

  const POINTS_CORRECT     = 10;
  const POINTS_WRONG       = 5;
  const NEXT_ROUND_DELAY   = 700;

  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    let score         = 0;
    let timeLeft      = gameDuration;
    let isGameOver    = false;
    let isWaiting     = false;
    let timerInterval = null;
    let roundTimeout  = null;
    let currentInkColor = null;

    let dom = {};

    function buildUI() {
      container.innerHTML = '';
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        position: relative;
        background:#f7f3ee;
        font-family: var(--font-body);
      `;

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

      const scoreChip = document.createElement('div');
      scoreChip.className = 'score-chip';
      scoreChip.innerHTML = `<span class="score-icon">⭐</span><span id="cm-score-${playerIndex}">0</span>점`;

      const timerWrap = document.createElement('div');
      timerWrap.style.cssText = 'display:flex; align-items:center; gap:var(--space-xs);';
      timerWrap.innerHTML = `<span>⏱</span><div class="timer-digit" id="cm-timer-${playerIndex}">${gameDuration}</div>`;

      topBar.appendChild(scoreChip);
      topBar.appendChild(timerWrap);

      const timerBarWrap = document.createElement('div');
      timerBarWrap.className = 'timer-bar-wrapper';
      timerBarWrap.style.flexShrink = '0';
      const timerBarFill = document.createElement('div');
      timerBarFill.className = 'timer-bar-fill';
      timerBarFill.style.width = '100%';
      timerBarWrap.appendChild(timerBarFill);

      const instrEl = document.createElement('div');
      instrEl.style.cssText = `
        text-align: center;
        font-size: var(--text-xs);
        color: var(--on-surface-variant);
        padding: var(--space-xs) var(--space-sm);
        flex-shrink: 0;
      `;
      instrEl.textContent = '글자의 잉크 색상을 맞춰요! 단어 뜻이 아니에요! 🎨';

      const wordWrap = document.createElement('div');
      wordWrap.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding: var(--space-sm);
      `;
      const wordEl = document.createElement('div');
      wordEl.id = `cm-word-${playerIndex}`;
      wordEl.style.cssText = `
        font-family: var(--font-display);
        font-size: clamp(2.5rem, 10vw, 6rem);
        font-weight: bold;
        text-shadow: 0 0 30px currentColor, 0 4px 12px rgba(0,0,0,0.5);
        transition: all 0.1s;
        padding: var(--space-sm) var(--space-lg);
        border-radius: var(--radius-xl);
        background: var(--surface-container-high);
        text-align: center;
        min-width: 4ch;
      `;
      wordWrap.appendChild(wordEl);

      const feedbackEl = document.createElement('div');
      feedbackEl.id = `cm-feedback-${playerIndex}`;
      feedbackEl.style.cssText = `
        text-align: center;
        font-size: var(--text-md);
        font-family: var(--font-display);
        height: 2em;
        flex-shrink: 0;
        padding: 0 var(--space-sm);
      `;

      const btnArea = document.createElement('div');
      btnArea.id = `cm-btns-${playerIndex}`;
      btnArea.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: clamp(0.5rem, 2vw, 1rem);
        padding: var(--space-sm) var(--space-sm) var(--space-md);
        flex-shrink: 0;
      `;

      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(instrEl);
      container.appendChild(wordWrap);
      container.appendChild(feedbackEl);
      container.appendChild(btnArea);

      dom.scoreEl     = container.querySelector(`#cm-score-${playerIndex}`);
      dom.timerDigit  = container.querySelector(`#cm-timer-${playerIndex}`);
      dom.timerBar    = timerBarFill;
      dom.wordEl      = container.querySelector(`#cm-word-${playerIndex}`);
      dom.feedbackEl  = container.querySelector(`#cm-feedback-${playerIndex}`);
      dom.btnArea     = container.querySelector(`#cm-btns-${playerIndex}`);

      startGame();
    }

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

    function nextRound() {
      if (isGameOver) return;
      isWaiting = false;

      const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      let inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      while (inkColor.name === wordColor.name) {
        inkColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
      currentInkColor = inkColor;

      dom.wordEl.textContent = wordColor.name;
      dom.wordEl.style.color = inkColor.hex;

      dom.wordEl.style.animation = 'none';
      void dom.wordEl.offsetWidth;
      dom.wordEl.style.animation = 'bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';

      const others = COLORS.filter(c => c.name !== inkColor.name);
      shuffle(others);
      const choices = [inkColor, others[0], others[1], others[2]];
      shuffle(choices);

      dom.btnArea.innerHTML = '';
      dom.feedbackEl.textContent = '';

      choices.forEach(color => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          width: clamp(3.5rem, 14vw, 6rem);
          height: clamp(3.5rem, 14vw, 6rem);
          border-radius: var(--radius-full);
          border: 3px solid rgba(0,0,0,0.2);
          background: ${color.hex};
          cursor: pointer;
          touch-action: manipulation;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.15em;
          box-shadow: 0 0 16px 2px ${color.hex}55, 0 4px 12px rgba(0,0,0,0.4);
          transition: transform 0.1s, filter 0.1s;
          font-family: var(--font-display);
          font-size: clamp(0.55rem, 1.5vw, 0.85rem);
          color: rgba(0,0,0,0.75);
          font-weight: bold;
        `;
        btn.innerHTML = `<span style="font-size:1.8em;">●</span><span>${color.name}</span>`;
        btn.title = color.name;

        const onTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isWaiting || isGameOver) return;
          handleChoice(color, btn);
        };
        btn.addEventListener('touchend', onTap, { passive: false });
        btn.addEventListener('click', onTap);

        dom.btnArea.appendChild(btn);
      });
    }

    function handleChoice(chosenColor, btn) {
      isWaiting = true;
      const correct = chosenColor.name === currentInkColor.name;

      if (correct) {
        score += POINTS_CORRECT;
        window.SoundEngine?.play('correct');
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-correct);">✅ 정답! +${POINTS_CORRECT}</span>`;
        btn.style.transform = 'scale(1.25)';
        btn.style.filter    = 'brightness(1.3)';
        dom.wordEl.style.outline = '4px solid var(--color-correct)';
      } else {
        score = Math.max(0, score - POINTS_WRONG);
        window.SoundEngine?.play('wrong');
        dom.feedbackEl.innerHTML = `<span style="color:var(--color-wrong);">❌ 틀렸어요! -${POINTS_WRONG}</span>`;
        btn.style.animation = 'shake 0.4s ease-out';
        btn.style.filter    = 'brightness(0.6)';
        dom.wordEl.style.outline = '4px solid var(--color-wrong)';
      }

      updateScoreUI();

      dom.btnArea.querySelectorAll('button').forEach(b => {
        b.style.pointerEvents = 'none';
        if (b !== btn) b.style.opacity = '0.5';
      });

      roundTimeout = setTimeout(() => {
        dom.wordEl.style.outline = '';
        nextRound();
      }, NEXT_ROUND_DELAY);
    }

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

    function triggerGameOver() {
      isGameOver = true;
      isWaiting  = true;
      clearTimeout(roundTimeout);

      const key  = `color-match-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));

      const trophy = score >= 150 ? '🏆' : score >= 80 ? '🥈' : '🎨';
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

    function updateScoreUI() {
      if (dom.scoreEl) dom.scoreEl.textContent = score;
    }

    function updateTimerUI() {
      if (!dom.timerDigit || !dom.timerBar) return;
      dom.timerDigit.textContent = timeLeft;
      const pct = (timeLeft / gameDuration) * 100;
      dom.timerBar.style.width = `${pct}%`;
      const urgent = timeLeft <= 10;
      dom.timerDigit.classList.toggle('urgent', urgent);
      dom.timerBar.classList.toggle('urgent', urgent);
    }

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

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['color-match'] = { init };

})();
