'use strict';

/**
 * games/drawing-game/game.js
 * "빨리 그리기" — AI Drawing Recognition Game
 *
 * Gameplay:
 *  - All players see the same Korean word (제시어).
 *  - Each player draws in their own canvas.
 *  - ml5.js DoodleNet (Quick Draw model) classifies drawings in real-time.
 *  - First player whose drawing is recognized correctly wins the round.
 *  - Play for N rounds; highest score wins.
 *
 * Architecture:
 *  - Registers itself at window.GameModules['drawing-game'].
 *  - Uses a shared DrawingGameCoordinator across all panels.
 *  - ml5 + DoodleNet loaded once, shared via module-level promise.
 */

(function registerDrawingGame() {

  /* ── Word list: Korean display ↔ Quick Draw English label ── */
  const WORD_LIST = [
    { ko: '고양이',   en: 'cat' },
    { ko: '강아지',   en: 'dog' },
    { ko: '집',       en: 'house' },
    { ko: '나무',     en: 'tree' },
    { ko: '자동차',   en: 'car' },
    { ko: '물고기',   en: 'fish' },
    { ko: '새',       en: 'bird' },
    { ko: '태양',     en: 'sun' },
    { ko: '달',       en: 'moon' },
    { ko: '사과',     en: 'apple' },
    { ko: '바나나',   en: 'banana' },
    { ko: '꽃',       en: 'flower' },
    { ko: '배',       en: 'sailboat' },
    { ko: '비행기',   en: 'airplane' },
    { ko: '자전거',   en: 'bicycle' },
    { ko: '의자',     en: 'chair' },
    { ko: '책',       en: 'book' },
    { ko: '모자',     en: 'hat' },
    { ko: '피자',     en: 'pizza' },
    { ko: '별',       en: 'star' },
    { ko: '눈사람',   en: 'snowman' },
    { ko: '케이크',   en: 'cake' },
    { ko: '시계',     en: 'clock' },
    { ko: '우산',     en: 'umbrella' },
    { ko: '안경',     en: 'eyeglasses' },
    { ko: '코끼리',   en: 'elephant' },
    { ko: '토끼',     en: 'rabbit' },
    { ko: '피아노',   en: 'piano' },
    { ko: '기타',     en: 'guitar' },
    { ko: '축구공',   en: 'soccer ball' },
  ];

  /* ── ml5 / DoodleNet: loaded once, shared ─────────────────── */
  let _classifierPromise = null;

  function getClassifier() {
    if (_classifierPromise) return _classifierPromise;
    _classifierPromise = new Promise((resolve, reject) => {
      function buildClassifier() {
        const clf = window.ml5.imageClassifier('DoodleNet', (err) => {
          if (err) { reject(err); return; }
          resolve(clf);
        });
      }

      if (window.ml5) {
        buildClassifier();
      } else {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/ml5@0.12.2/dist/ml5.min.js';
        s.onload = buildClassifier;
        s.onerror = () => reject(new Error('ml5 load failed'));
        document.head.appendChild(s);
      }
    });
    return _classifierPromise;
  }

  /* ── Coordinator: shared round state across all panels ──────── */
  function createCoordinator(totalPlayers, gameDuration) {
    const TOTAL_ROUNDS = Math.max(3, Math.ceil(gameDuration / 15));
    const ROUND_SECONDS = 20;

    let panels = [];
    let started = false;
    let classifierReady = false;
    let classifier = null;
    let currentWord = null;
    let currentRound = 0;
    let roundActive = false;
    let roundTimer = null;
    let usedWords = new Set();

    function broadcast(event, data) {
      panels.forEach(p => p.cb[event]?.(data));
    }

    function pickWord() {
      const avail = WORD_LIST.filter(w => !usedWords.has(w.en));
      const pool = avail.length ? avail : WORD_LIST;
      const w = pool[Math.floor(Math.random() * pool.length)];
      usedWords.add(w.en);
      return w;
    }

    function startRound() {
      if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
      currentRound++;
      currentWord = pickWord();
      roundActive = false;
      broadcast('roundStart', { round: currentRound, totalRounds: TOTAL_ROUNDS, word: currentWord });

      let cnt = 3;
      broadcast('countdown', { count: cnt });
      const tick = setInterval(() => {
        cnt--;
        if (cnt > 0) {
          broadcast('countdown', { count: cnt });
        } else {
          clearInterval(tick);
          roundActive = true;
          broadcast('drawStart', { word: currentWord });
          roundTimer = setTimeout(() => {
            if (!roundActive) return;
            roundActive = false;
            broadcast('roundOver', { winner: null, word: currentWord });
            setTimeout(startRound, 3500);
          }, ROUND_SECONDS * 1000);
        }
      }, 1000);
    }

    function endGame() {
      _coord._gameover = true;
      broadcast('gameOver', {});
    }

    function tryStart() {
      if (started || !classifierReady || panels.length < totalPlayers) return;
      started = true;
      setTimeout(startRound, 600);
    }

    const _coord = {
      _gameover: false,
      _scores: {},

      register(playerIndex, cb) {
        panels.push({ playerIndex, cb });
        tryStart();
      },

      setClassifier(clf) {
        classifier = clf;
        classifierReady = true;
        broadcast('modelReady', {});
        tryStart();
      },

      reportCorrect(playerIndex) {
        if (!roundActive) return;
        roundActive = false;
        clearTimeout(roundTimer);
        broadcast('roundOver', { winner: playerIndex, word: currentWord });
        setTimeout(startRound, 3500);
      },

      classify(canvas, cb) {
        if (!classifier) return;
        try { classifier.classify(canvas, cb); } catch (e) {}
      },

      getCurrentWord() { return currentWord; },
      isRoundActive() { return roundActive; },

      destroy() {
        clearTimeout(roundTimer);
        panels = [];
      },
    };

    return _coord;
  }

  /* ── init() ─────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = window._gameSettings?.duration || 60;
    const totalPlayers = window._gameSettings?.playerCount || 1;

    /* Coordinator: reuse within the same game session, fresh on new game */
    if (!window._DrawingCoord || window._DrawingCoord._gameover) {
      window._DrawingCoord?.destroy();
      window._DrawingCoord = createCoordinator(totalPlayers, gameDuration);
    }
    const coord = window._DrawingCoord;

    /* ── State ─────────────────────────────────────────────── */
    let myScore     = 0;
    let isDrawing   = false;
    let lastX = 0, lastY = 0;
    let classifyIv  = null;
    let dead        = false;
    let phase       = 'loading'; // loading | countdown | drawing | roundover | gameover

    /* ── Build DOM ────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#1c1c2e;';

    /* Top bar: word + AI guess */
    const topBar = el('div', {
      style: `flex-shrink:0;padding:8px 12px 6px;background:#16213e;
              border-bottom:1px solid rgba(126,211,255,0.15);text-align:center;`,
    });
    const wordEl = el('div', {
      style: `font-size:1.3rem;font-weight:bold;color:#fdd34d;letter-spacing:1px;line-height:1.2;`,
      text: 'AI 모델 로딩 중...',
    });
    const aiEl = el('div', {
      style: `font-size:0.8rem;color:#7ed3ff;margin-top:3px;min-height:1.1em;`,
      text: '\u00a0',
    });
    topBar.append(wordEl, aiEl);

    /* Canvas wrapper */
    const canvasWrap = el('div', {
      style: `flex:1;position:relative;overflow:hidden;background:#f7f3ea;touch-action:none;cursor:crosshair;`,
    });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    canvasWrap.appendChild(canvas);

    /* Overlay (countdown / results) */
    const overlay = el('div', {
      style: `position:absolute;inset:0;display:flex;flex-direction:column;
              align-items:center;justify-content:center;text-align:center;
              background:rgba(22,33,62,0.88);backdrop-filter:blur(2px);`,
    });
    canvasWrap.appendChild(overlay);

    /* Bottom bar */
    const botBar = el('div', {
      style: `flex-shrink:0;padding:5px 12px;display:flex;align-items:center;
              justify-content:space-between;background:#16213e;
              border-top:1px solid rgba(126,211,255,0.15);`,
    });
    const clearBtn = el('button', {
      style: `background:#e53e3e;color:#fff;border:none;border-radius:6px;
              padding:4px 14px;font-size:0.82rem;cursor:pointer;
              font-family:var(--font-body);`,
      text: '지우기',
    });
    const scoreEl = el('span', {
      style: `color:#fdd34d;font-size:0.9rem;font-weight:bold;`,
      text: '점수: 0',
    });
    botBar.append(clearBtn, scoreEl);

    container.append(topBar, canvasWrap, botBar);

    /* ── Canvas drawing ───────────────────────────────────── */
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      const r = canvasWrap.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      clearCanvas();
    }

    function clearCanvas() {
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth   = Math.max(3, canvas.width * 0.012);
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
    }

    function getPos(e) {
      const r  = canvas.getBoundingClientRect();
      const sx = canvas.width  / r.width;
      const sy = canvas.height / r.height;
      const s  = e.touches ? e.touches[0] : e;
      return { x: (s.clientX - r.left) * sx, y: (s.clientY - r.top) * sy };
    }

    function onDown(e) {
      if (phase !== 'drawing') return;
      e.preventDefault();
      isDrawing = true;
      const { x, y } = getPos(e);
      lastX = x; lastY = y;
    }
    function onMove(e) {
      if (!isDrawing || phase !== 'drawing') return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x; lastY = y;
    }
    function onUp() { isDrawing = false; }

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove',  onMove, { passive: false });
    canvas.addEventListener('touchend',   onUp);

    clearBtn.addEventListener('click', () => { if (phase === 'drawing') clearCanvas(); });

    /* ── AI classification loop ───────────────────────────── */
    function startClassify() {
      stopClassify();
      classifyIv = setInterval(() => {
        if (dead || phase !== 'drawing') return;
        const word = coord.getCurrentWord();
        if (!word) return;

        coord.classify(canvas, (err, results) => {
          if (dead || phase !== 'drawing' || !results?.length) return;

          const top = results[0];
          const pct = Math.round(top.confidence * 100);
          const near = results.slice(0, 5).find(
            r => r.label.toLowerCase() === word.en.toLowerCase()
          );

          /* Update AI display */
          if (near) {
            const nearPct = Math.round(near.confidence * 100);
            aiEl.innerHTML = `<span style="color:#fdd34d;">🎯 ${word.ko}? ${nearPct}%</span>`;
          } else {
            aiEl.textContent = `AI: ${top.label} (${pct}%)`;
          }

          /* Check match — top-5 results with threshold */
          const match = results.slice(0, 5).find(
            r => r.label.toLowerCase() === word.en.toLowerCase() && r.confidence >= 0.28
          );
          if (match) coord.reportCorrect(playerIndex);
        });
      }, 900);
    }

    function stopClassify() {
      if (classifyIv) { clearInterval(classifyIv); classifyIv = null; }
    }

    /* ── Coordinator callbacks ────────────────────────────── */
    function showOverlay(html) {
      overlay.innerHTML = html;
      overlay.style.display = 'flex';
    }
    function hideOverlay() {
      overlay.style.display = 'none';
    }

    coord.register(playerIndex, {
      modelReady() {
        wordEl.textContent = '곧 시작해요!';
      },

      roundStart({ round, totalRounds, word }) {
        phase = 'countdown';
        stopClassify();
        clearCanvas();
        aiEl.innerHTML = '\u00a0';
        wordEl.innerHTML = `<span style="color:#aaa;font-size:0.8rem;">${round}/${totalRounds} 라운드 &nbsp;|&nbsp; 제시어</span><br><span style="color:#fdd34d;">${word.ko}</span>`;
        showOverlay(`
          <div style="font-size:0.95rem;color:#7ed3ff;margin-bottom:10px;">${round} / ${totalRounds} 라운드</div>
          <div style="font-size:2.2rem;font-weight:bold;color:#fdd34d;margin-bottom:6px;">${word.ko}</div>
          <div style="font-size:0.9rem;color:#ccc;">준비하세요!</div>
        `);
      },

      countdown({ count }) {
        showOverlay(`<div style="font-size:5rem;color:#fff;text-shadow:0 0 20px rgba(253,211,77,0.6);">${count}</div>`);
      },

      drawStart({ word }) {
        phase = 'drawing';
        hideOverlay();
        clearCanvas();
        wordEl.innerHTML = `<span style="color:#aaa;font-size:0.8rem;">제시어</span> <span style="color:#fdd34d;">${word.ko}</span>`;
        aiEl.innerHTML = '\u00a0';
        startClassify();
      },

      roundOver({ winner, word }) {
        phase = 'roundover';
        stopClassify();

        if (winner === playerIndex) {
          myScore++;
          coord._scores[playerIndex] = myScore;
          scoreEl.textContent = `점수: ${myScore}`;
          showOverlay(`
            <div style="font-size:3.5rem;">🎉</div>
            <div style="font-size:1.4rem;color:#4ade80;margin-top:8px;font-weight:bold;">맞췄다!</div>
            <div style="color:#fdd34d;font-size:1rem;margin-top:4px;">${word.ko}</div>
          `);
        } else if (winner === null) {
          showOverlay(`
            <div style="font-size:2.5rem;">⏰</div>
            <div style="font-size:1rem;color:#f87171;margin-top:8px;">시간 초과</div>
            <div style="color:#aaa;font-size:0.9rem;margin-top:4px;">정답: <b>${word.ko}</b></div>
          `);
        } else {
          showOverlay(`
            <div style="font-size:2rem;">😓</div>
            <div style="font-size:1rem;color:#aaa;margin-top:8px;">P${winner + 1}이 먼저 맞췄어요!</div>
            <div style="color:#fdd34d;font-size:0.9rem;margin-top:4px;">정답: <b>${word.ko}</b></div>
          `);
        }
      },

      gameOver() {
        phase = 'gameover';
        stopClassify();
        const allScores = coord._scores;
        const maxScore  = Math.max(0, ...Object.values(allScores));
        const isWinner  = myScore === maxScore && myScore > 0;
        showOverlay(`
          <div style="font-size:2.5rem;">${isWinner ? '🏆' : '🎨'}</div>
          <div style="font-size:1.1rem;color:#fdd34d;margin-top:8px;">게임 종료</div>
          <div style="font-size:1.8rem;font-weight:bold;margin-top:6px;color:#fff;">점수: ${myScore}</div>
          ${isWinner && totalPlayers > 1 ? '<div style="color:#4ade80;font-size:0.9rem;margin-top:6px;">🥇 최고 점수!</div>' : ''}
        `);
        if (onGameOver) onGameOver(myScore);
      },
    });

    /* ── Load ml5 + DoodleNet ─────────────────────────────── */
    showOverlay('<div style="font-size:1rem;color:#7ed3ff;">AI 모델 로딩 중...<br><span style="font-size:0.8rem;color:#888;margin-top:6px;display:block;">처음 로딩 시 시간이 걸릴 수 있어요</span></div>');

    getClassifier()
      .then(clf => {
        if (!dead) coord.setClassifier(clf);
      })
      .catch(err => {
        console.error('[drawing-game] Model load error:', err);
        if (!dead) {
          showOverlay('<div style="color:#f87171;font-size:0.9rem;">AI 로딩 실패<br><span style="font-size:0.8rem;color:#888;">네트워크를 확인해 주세요</span></div>');
        }
      });

    /* ── Resize ───────────────────────────────────────────── */
    resizeCanvas();
    const ro = new ResizeObserver(() => { if (!dead) resizeCanvas(); });
    ro.observe(canvasWrap);

    /* ── Destroy ──────────────────────────────────────────── */
    function destroy() {
      dead = true;
      stopClassify();
      ro.disconnect();
      container.innerHTML = '';
    }

    return { destroy };
  }

  /* ── Tiny DOM helper ────────────────────────────────────── */
  function el(tag, { style, text } = {}) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text)  e.textContent = text;
    return e;
  }

  /* ── Register ───────────────────────────────────────────── */
  window.GameModules = window.GameModules || {};
  window.GameModules['drawing-game'] = { init };

})();
