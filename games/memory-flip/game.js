'use strict';
/**
 * games/memory-flip/game.js
 * "기억 카드" — Memory Flip mini-game
 *
 * Classic memory card matching game.
 * 4×3 grid = 12 cards = 6 pairs of emoji.
 * Flip two cards — if they match, they stay face-up with a glow.
 * Match all 6 pairs to win!
 *
 * Timer counts down; score = pairs × 20 when time runs out.
 * Bonus points if all pairs are matched before time's up!
 */

(function registerMemoryFlip() {

  /* ── Card pairs ── 6 emoji pairs ─────────────────── */
  const CARD_PAIRS = ['🌟', '🍎', '🐱', '🚀', '🎵', '🌈'];
  const TOTAL_PAIRS = CARD_PAIRS.length; // 6

  const FLIP_DELAY    = 1000; // ms before flipping back non-matching cards
  const WIN_BONUS     = 50;   // bonus points for completing before time
  const POINTS_PAIR   = 20;   // points per matched pair

  /* ─────────────────────────────────────────────────────
     init()
  ───────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    /* ── State ── */
    let score          = 0;
    let timeLeft       = gameDuration;
    let isGameOver     = false;
    let pairsFound     = 0;
    let flippedCards   = [];   // up to 2 card objects currently face-up
    let isChecking     = false; // locked while checking a pair
    let timerInterval  = null;
    let flipTimeout    = null;

    /* Card data: array of { emoji, index, matched, element } */
    let cards = [];

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
        background: var(--surface-container-low);
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
        <div class="score-chip"><span class="score-icon">⭐</span><span id="mf-score-${playerIndex}">0</span>점</div>
        <div style="font-family:var(--font-body);font-size:var(--text-xs);color:var(--on-surface-variant);">
          짝: <span id="mf-pairs-${playerIndex}">0</span>/${TOTAL_PAIRS} 🃏
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-xs);">
          <span>⏱</span>
          <div class="timer-digit" id="mf-timer-${playerIndex}">${gameDuration}</div>
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
      instrEl.textContent = '카드를 뒤집어 같은 그림 짝을 찾아요! 🃏';

      /* Card grid: 4 columns × 3 rows */
      const gridEl = document.createElement('div');
      gridEl.id = `mf-grid-${playerIndex}`;
      gridEl.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: clamp(0.35rem, 1.2vw, 0.7rem);
        padding: var(--space-xs) var(--space-sm) var(--space-sm);
        flex: 1;
        min-height: 0;
      `;

      /* Feedback */
      const feedbackEl = document.createElement('div');
      feedbackEl.id = `mf-feedback-${playerIndex}`;
      feedbackEl.style.cssText = `
        text-align: center;
        font-family: var(--font-display);
        font-size: var(--text-md);
        min-height: 2em;
        flex-shrink: 0;
        padding: 0 var(--space-sm);
      `;

      container.appendChild(topBar);
      container.appendChild(timerBarWrap);
      container.appendChild(instrEl);
      container.appendChild(gridEl);
      container.appendChild(feedbackEl);

      /* Cache refs */
      dom.scoreEl    = container.querySelector(`#mf-score-${playerIndex}`);
      dom.pairsEl    = container.querySelector(`#mf-pairs-${playerIndex}`);
      dom.timerDigit = container.querySelector(`#mf-timer-${playerIndex}`);
      dom.timerBar   = timerBarFill;
      dom.gridEl     = container.querySelector(`#mf-grid-${playerIndex}`);
      dom.feedbackEl = container.querySelector(`#mf-feedback-${playerIndex}`);

      startGame();
    }

    /* ─────────────────────────────────────
       GAME LOGIC
    ───────────────────────────────────── */
    function startGame() {
      score      = 0;
      timeLeft   = gameDuration;
      isGameOver = false;
      pairsFound = 0;
      flippedCards  = [];
      isChecking    = false;

      updateScoreUI();
      updateTimerUI();
      buildCards();
      startTimer();
    }

    /** Create 12 cards (6 pairs), shuffle, render into grid. */
    function buildCards() {
      // Make pairs
      const deck = [];
      CARD_PAIRS.forEach(emoji => {
        deck.push({ emoji, id: emoji + '_a', matched: false, element: null });
        deck.push({ emoji, id: emoji + '_b', matched: false, element: null });
      });
      shuffle(deck);
      cards = deck;

      dom.gridEl.innerHTML = '';

      cards.forEach((card, i) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
          position: relative;
          perspective: 600px;
          cursor: pointer;
          touch-action: manipulation;
        `;

        const inner = document.createElement('div');
        inner.style.cssText = `
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.45s cubic-bezier(0.34,1.2,0.64,1);
          border-radius: var(--radius-md);
        `;

        // Back face (face-down)
        const backFace = document.createElement('div');
        backFace.style.cssText = `
          position: absolute;
          inset: 0;
          border-radius: var(--radius-md);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(1rem, 3vw, 1.6rem);
          background: linear-gradient(135deg, var(--surface-container-high), var(--surface-variant));
          border: 2px solid var(--outline-variant);
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);
          color: var(--on-surface-variant);
        `;
        backFace.textContent = '❔';

        // Front face (face-up)
        const frontFace = document.createElement('div');
        frontFace.style.cssText = `
          position: absolute;
          inset: 0;
          border-radius: var(--radius-md);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(180deg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(1.4rem, 4.5vw, 2.8rem);
          background: var(--surface-container-highest);
          border: 2px solid var(--outline-variant);
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.2);
        `;
        frontFace.textContent = card.emoji;

        inner.appendChild(backFace);
        inner.appendChild(frontFace);
        wrapper.appendChild(inner);

        // Store references in card object
        card.element   = wrapper;
        card.innerEl   = inner;
        card.frontFace = frontFace;
        card.backFace  = backFace;
        card.isFlipped = false;

        // Entrance animation stagger
        wrapper.style.opacity = '0';
        wrapper.style.transform = 'scale(0.7)';
        wrapper.style.transition = `opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)`;
        wrapper.style.transitionDelay = `${i * 40}ms`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            wrapper.style.opacity = '';
            wrapper.style.transform = '';
          });
        });

        const onTap = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onCardTap(card);
        };
        wrapper.addEventListener('touchend', onTap, { passive: false });
        wrapper.addEventListener('click', onTap);

        dom.gridEl.appendChild(wrapper);
      });
    }

    function flipCard(card, faceUp) {
      card.isFlipped = faceUp;
      card.innerEl.style.transform = faceUp ? 'rotateY(180deg)' : '';
    }

    function onCardTap(card) {
      if (isGameOver || isChecking) return;
      if (card.matched) return;
      window.SoundEngine?.play("flip");
      if (card.isFlipped) return;
      if (flippedCards.length >= 2) return;

      flipCard(card, true);
      flippedCards.push(card);
      dom.feedbackEl.textContent = '';

      if (flippedCards.length === 2) {
        isChecking = true;
        checkPair();
      }
    }

    function checkPair() {
      const [a, b] = flippedCards;

      if (a.emoji === b.emoji) {
        // Match!
        pairsFound++;
        score += POINTS_PAIR;
        window.SoundEngine?.play("correct");
        updateScoreUI();
        updatePairsUI();

        // Glow effect on matched cards using playerColor
        [a, b].forEach(card => {
          card.matched = true;
          card.element.style.pointerEvents = 'none';
          card.frontFace.style.border = `3px solid ${playerColor}`;
          card.frontFace.style.boxShadow = `0 0 18px 4px ${playerColor}55, inset 0 2px 8px rgba(0,0,0,0.2)`;
          card.innerEl.style.animation = 'bounceIn 0.4s both';
        });

        dom.feedbackEl.innerHTML = `<span style="color:var(--color-correct);">🎉 짝! +${POINTS_PAIR}</span>`;

        flippedCards  = [];
        isChecking    = false;

        if (pairsFound >= TOTAL_PAIRS) {
          // All pairs matched — win!
          clearInterval(timerInterval);
          setTimeout(() => triggerGameOver(true), 800);
        }
      } else {
        // No match — flip back
        window.SoundEngine?.play("wrong");
        dom.feedbackEl.innerHTML = `<span style="color:var(--on-surface-variant);">😅 다시 기억해봐요!</span>`;

        // Brief red tint
        [a, b].forEach(card => {
          card.frontFace.style.border = '2px solid var(--color-wrong)';
        });

        flipTimeout = setTimeout(() => {
          [a, b].forEach(card => {
            flipCard(card, false);
            card.frontFace.style.border = '';
          });
          flippedCards = [];
          isChecking   = false;
          dom.feedbackEl.textContent = '';
        }, FLIP_DELAY);
      }
    }

    function updatePairsUI() {
      if (dom.pairsEl) dom.pairsEl.textContent = pairsFound;
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
      isGameOver = true;
      isChecking = true;
      clearTimeout(flipTimeout);

      // Calculate final score
      if (win) { score += WIN_BONUS; score += timeLeft * 2; }

      const key  = `memory-flip-score-p${playerIndex}`;
      const best = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > best) localStorage.setItem(key, String(score));

      const trophy    = win ? '🏆' : pairsFound >= 4 ? '🥈' : '🃏';
      const isNewBest = score > best;

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${win ? '🎉 완성!' : trophy + ' 게임 종료!'}</div>
        ${win
          ? `<div style="font-family:var(--font-display);font-size:var(--text-xl);animation:bounceIn 0.5s 0.1s both;">모든 짝! +${WIN_BONUS} + ⏱${timeLeft}×2 보너스!</div>`
          : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${pairsFound}/${TOTAL_PAIRS} 짝 완성</div>`
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
      clearTimeout(flipTimeout);
      isGameOver = true;
      if (container) container.innerHTML = '';
      cards = [];
      dom   = {};
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
  window.GameModules['memory-flip'] = { init };

})();
