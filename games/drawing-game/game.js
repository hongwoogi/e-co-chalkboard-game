'use strict';

/**
 * games/drawing-game/game.js
 * "빨리 그리기" — AI Drawing Recognition Game
 */

(function registerDrawingGame() {

  /* ── Word list: Korean display ↔ Quick Draw English label ────── */
  const WORD_LIST = [
    // 동물
    { ko: '고양이',     en: 'cat' },
    { ko: '강아지',     en: 'dog' },
    { ko: '새',         en: 'bird' },
    { ko: '물고기',     en: 'fish' },
    { ko: '코끼리',     en: 'elephant' },
    { ko: '토끼',       en: 'rabbit' },
    { ko: '말',         en: 'horse' },
    { ko: '소',         en: 'cow' },
    { ko: '돼지',       en: 'pig' },
    { ko: '곰',         en: 'bear' },
    { ko: '사자',       en: 'lion' },
    { ko: '호랑이',     en: 'tiger' },
    { ko: '펭귄',       en: 'penguin' },
    { ko: '상어',       en: 'shark' },
    { ko: '문어',       en: 'octopus' },
    { ko: '나비',       en: 'butterfly' },
    { ko: '개구리',     en: 'frog' },
    { ko: '뱀',         en: 'snake' },
    { ko: '거북이',     en: 'turtle' },
    { ko: '게',         en: 'crab' },
    { ko: '고래',       en: 'whale' },
    { ko: '악어',       en: 'crocodile' },
    // 자연
    { ko: '나무',       en: 'tree' },
    { ko: '태양',       en: 'sun' },
    { ko: '달',         en: 'moon' },
    { ko: '별',         en: 'star' },
    { ko: '꽃',         en: 'flower' },
    { ko: '산',         en: 'mountain' },
    { ko: '무지개',     en: 'rainbow' },
    { ko: '번개',       en: 'lightning' },
    { ko: '불꽃',       en: 'fire' },
    // 사물
    { ko: '집',         en: 'house' },
    { ko: '의자',       en: 'chair' },
    { ko: '책',         en: 'book' },
    { ko: '시계',       en: 'clock' },
    { ko: '우산',       en: 'umbrella' },
    { ko: '안경',       en: 'eyeglasses' },
    { ko: '열쇠',       en: 'key' },
    { ko: '전구',       en: 'light bulb' },
    { ko: '병',         en: 'bottle' },
    { ko: '양초',       en: 'candle' },
    // 음식
    { ko: '사과',       en: 'apple' },
    { ko: '바나나',     en: 'banana' },
    { ko: '피자',       en: 'pizza' },
    { ko: '케이크',     en: 'cake' },
    { ko: '아이스크림', en: 'ice cream' },
    { ko: '수박',       en: 'watermelon' },
    { ko: '포도',       en: 'grapes' },
    { ko: '당근',       en: 'carrot' },
    { ko: '브로콜리',   en: 'broccoli' },
    { ko: '샌드위치',   en: 'sandwich' },
    // 탈것
    { ko: '자동차',     en: 'car' },
    { ko: '비행기',     en: 'airplane' },
    { ko: '자전거',     en: 'bicycle' },
    { ko: '돛단배',     en: 'sailboat' },
    { ko: '기차',       en: 'train' },
    { ko: '헬리콥터',   en: 'helicopter' },
    { ko: '로켓',       en: 'rocket' },
    // 옷/도구
    { ko: '모자',       en: 'hat' },
    { ko: '신발',       en: 'shoe' },
    { ko: '양말',       en: 'sock' },
    { ko: '가방',       en: 'backpack' },
    { ko: '연필',       en: 'pencil' },
    // 음악/스포츠
    { ko: '피아노',     en: 'piano' },
    { ko: '기타',       en: 'guitar' },
    { ko: '축구공',     en: 'soccer ball' },
    // 기타
    { ko: '하트',       en: 'heart' },
    { ko: '다이아몬드', en: 'diamond' },
    { ko: '손',         en: 'hand' },
    { ko: '얼굴',       en: 'face' },
    { ko: '눈사람',     en: 'snowman' },
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
        s.src = '/js/ml5.min.js';
        s.onload = buildClassifier;
        s.onerror = () => reject(new Error('ml5 load failed'));
        document.head.appendChild(s);
      }
    });
    return _classifierPromise;
  }

  /* ── Coordinator: shared round state across all panels ──────── */
  function createCoordinator(totalPlayers, gameDuration) {
    const TOTAL_ROUNDS  = Math.max(3, Math.ceil(gameDuration / 15));
    const ROUND_SECONDS = 20;

    let panels = [], started = false, classifierReady = false, classifier = null;
    let currentWord = null, currentRound = 0, roundActive = false, roundTimer = null;
    let usedWords = new Set();

    function broadcast(event, data) { panels.forEach(p => p.cb[event]?.(data)); }

    function pickWord() {
      const avail = WORD_LIST.filter(w => !usedWords.has(w.en));
      const pool  = avail.length ? avail : WORD_LIST;
      const w     = pool[Math.floor(Math.random() * pool.length)];
      usedWords.add(w.en);
      return w;
    }

    function startRound() {
      if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
      currentRound++;
      currentWord  = pickWord();
      roundActive  = false;
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

    function endGame() { _coord._gameover = true; broadcast('gameOver', {}); }

    function tryStart() {
      if (started || !classifierReady || panels.length < totalPlayers) return;
      started = true;
      setTimeout(startRound, 600);
    }

    const _coord = {
      _gameover: false,
      _scores: {},

      register(playerIndex, cb) { panels.push({ playerIndex, cb }); tryStart(); },

      setClassifier(clf) {
        classifier = clf; classifierReady = true;
        broadcast('modelReady', {}); tryStart();
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

      getCurrentWord()  { return currentWord; },
      isRoundActive()   { return roundActive; },

      destroy() { clearTimeout(roundTimer); panels = []; },
    };

    return _coord;
  }

  /* ── init() ─────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const gameDuration = window._gameSettings?.duration  || 60;
    const totalPlayers = window._gameSettings?.playerCount || 1;

    if (!window._DrawingCoord || window._DrawingCoord._gameover) {
      window._DrawingCoord?.destroy();
      window._DrawingCoord = createCoordinator(totalPlayers, gameDuration);
    }
    const coord = window._DrawingCoord;

    /* ── State ─────────────────────────────────────────────── */
    let myScore = 0, isDrawing = false, lastX = 0, lastY = 0;
    let classifyIv = null, dead = false;
    let phase = 'loading';

    /* ── Build DOM ────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#1c1c2e;';

    /* Top bar */
    const topBar = el('div', {
      style: `flex-shrink:0;padding:7px 12px 6px;background:#16213e;
              border-bottom:1px solid rgba(126,211,255,0.15);`,
    });

    /* Word display */
    const wordEl = el('div', {
      style: `font-size:1.2rem;font-weight:bold;color:#fdd34d;letter-spacing:1px;
              text-align:center;line-height:1.25;margin-bottom:5px;`,
      text: 'AI 모델 로딩 중...',
    });

    /* AI confidence bar row */
    const barRow = el('div', {
      style: `display:flex;align-items:center;gap:6px;`,
    });
    const barLabel = el('span', {
      style: `font-size:0.72rem;color:#888;min-width:72px;max-width:72px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;`,
      text: '—',
    });
    const barTrack = el('div', {
      style: `flex:1;height:9px;background:rgba(255,255,255,0.08);
              border-radius:5px;overflow:hidden;`,
    });
    const barFill = el('div', {
      style: `height:100%;width:0%;background:#7ed3ff;border-radius:5px;
              transition:width 0.35s ease,background 0.25s;`,
    });
    const barPct = el('span', {
      style: `font-size:0.72rem;color:#888;min-width:30px;text-align:left;`,
      text: '0%',
    });
    barTrack.appendChild(barFill);
    barRow.append(barLabel, barTrack, barPct);
    topBar.append(wordEl, barRow);

    /* Canvas wrapper */
    const canvasWrap = el('div', {
      style: `flex:1;position:relative;overflow:hidden;background:#f7f3ea;touch-action:none;cursor:crosshair;`,
    });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    canvasWrap.appendChild(canvas);

    /* Overlay */
    const overlay = el('div', {
      style: `position:absolute;inset:0;display:flex;flex-direction:column;padding:16px;
              align-items:center;justify-content:center;text-align:center;
              background:rgba(22,33,62,0.9);backdrop-filter:blur(2px);`,
    });
    canvasWrap.appendChild(overlay);

    /* Bottom bar */
    const botBar = el('div', {
      style: `flex-shrink:0;padding:5px 12px;display:flex;align-items:center;
              justify-content:space-between;background:#16213e;
              border-top:1px solid rgba(126,211,255,0.15);`,
    });
    const clearBtn = el('button', {
      style: `background:#c0392b;color:#fff;border:none;border-radius:6px;
              padding:4px 14px;font-size:0.8rem;cursor:pointer;font-family:var(--font-body);`,
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
      canvas.width = w; canvas.height = h;
      clearCanvas();
    }

    function clearCanvas() {
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth   = Math.max(3, canvas.width * 0.013);
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
      e.preventDefault(); isDrawing = true;
      ({ x: lastX, y: lastY } = getPos(e));
    }
    function onMove(e) {
      if (!isDrawing || phase !== 'drawing') return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
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

    /* ── AI bar update ────────────────────────────────────── */
    function updateBar(results, word) {
      if (!results?.length) return;
      const top = results[0];
      const topPct = Math.round(top.confidence * 100);

      // Find target word in top results
      const targetHit = results.slice(0, 10).find(
        r => r.label.toLowerCase() === word.en.toLowerCase()
      );

      if (targetHit) {
        const tPct = Math.round(targetHit.confidence * 100);
        const isTop = targetHit === top;

        // Show target progress when detected
        barFill.style.width    = `${tPct}%`;
        barLabel.textContent   = `🎯 ${word.ko}`;
        barPct.textContent     = `${tPct}%`;

        if (isTop && tPct >= 28) {
          // Top result AND high confidence → green (about to win)
          barFill.style.background = '#4ade80';
          barLabel.style.color     = '#4ade80';
          barPct.style.color       = '#4ade80';
        } else {
          // Target detected but not top → yellow
          barFill.style.background = '#fdd34d';
          barLabel.style.color     = '#fdd34d';
          barPct.style.color       = '#fdd34d';
        }
      } else {
        // Show top AI guess normally
        barFill.style.width    = `${topPct}%`;
        barFill.style.background = '#7ed3ff';
        barLabel.textContent   = top.label;
        barLabel.style.color   = '#888';
        barPct.textContent     = `${topPct}%`;
        barPct.style.color     = '#888';
      }
    }

    function resetBar() {
      barFill.style.width      = '0%';
      barFill.style.background = '#7ed3ff';
      barLabel.textContent     = '—';
      barLabel.style.color     = '#888';
      barPct.textContent       = '0%';
      barPct.style.color       = '#888';
    }

    /* ── Canvas preprocessing: crop to drawing, scale to 280×280 ── */
    function getProcessedCanvas() {
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = idata.data;
      let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (d[i] < 180 || d[i+1] < 180 || d[i+2] < 180) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      /* Nothing drawn yet — skip classification */
      if (x1 <= x0 || y1 <= y0 || (x1 - x0) < 5) return null;

      const pad  = Math.max(x1 - x0, y1 - y0) * 0.25;
      const srcX = Math.max(0,              Math.round(x0 - pad));
      const srcY = Math.max(0,              Math.round(y0 - pad));
      const srcX2 = Math.min(canvas.width,  Math.round(x1 + pad));
      const srcY2 = Math.min(canvas.height, Math.round(y1 + pad));
      const srcW  = srcX2 - srcX;
      const srcH  = srcY2 - srcY;
      if (srcW < 5 || srcH < 5) return null;

      const size = 280;
      const tmp  = document.createElement('canvas');
      tmp.width  = size; tmp.height = size;
      const tc   = tmp.getContext('2d');
      tc.fillStyle = '#ffffff';
      tc.fillRect(0, 0, size, size);

      const scale = Math.min((size - 20) / srcW, (size - 20) / srcH);
      const dw = srcW * scale, dh = srcH * scale;
      tc.drawImage(canvas, srcX, srcY, srcW, srcH,
        (size - dw) / 2, (size - dh) / 2, dw, dh);
      return tmp;
    }

    /* ── AI classification loop ───────────────────────────── */
    function startClassify() {
      stopClassify();
      classifyIv = setInterval(() => {
        if (dead || phase !== 'drawing') return;
        const word = coord.getCurrentWord();
        if (!word) return;

        coord.classify(getProcessedCanvas(), (err, results) => {
          if (dead || phase !== 'drawing' || !results?.length) return;
          updateBar(results, word);

          // Win condition: target in top-5 with sufficient confidence
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

    /* ── Overlay helpers ──────────────────────────────────── */
    function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; }
    function hideOverlay()     { overlay.style.display = 'none'; }

    /* ── Coordinator callbacks ────────────────────────────── */
    coord.register(playerIndex, {
      modelReady() { wordEl.textContent = '곧 시작해요!'; },

      roundStart({ round, totalRounds, word }) {
        phase = 'countdown';
        stopClassify(); clearCanvas(); resetBar();
        wordEl.innerHTML = `<span style="color:#aaa;font-size:0.75rem;">${round}/${totalRounds} 라운드 &nbsp;·&nbsp; 제시어</span><br>${word.ko}`;
        showOverlay(`
          <div style="font-size:0.9rem;color:#7ed3ff;margin-bottom:10px;">${round} / ${totalRounds} 라운드</div>
          <div style="font-size:2.4rem;font-weight:bold;color:#fdd34d;margin-bottom:8px;">${word.ko}</div>
          <div style="font-size:0.85rem;color:#ccc;">이 단어를 그려요!</div>
        `);
      },

      countdown({ count }) {
        showOverlay(`<div style="font-size:5rem;color:#fff;text-shadow:0 0 20px rgba(253,211,77,0.5);">${count}</div>`);
      },

      drawStart({ word }) {
        phase = 'drawing'; hideOverlay(); clearCanvas(); resetBar();
        wordEl.innerHTML = `<span style="color:#aaa;font-size:0.75rem;">제시어</span>&nbsp; <span style="color:#fdd34d;">${word.ko}</span>`;
        startClassify();
      },

      roundOver({ winner, word }) {
        phase = 'roundover'; stopClassify();
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
            <div style="color:#aaa;font-size:0.85rem;margin-top:4px;">정답: <b style="color:#fdd34d;">${word.ko}</b></div>
          `);
        } else {
          showOverlay(`
            <div style="font-size:2rem;">😓</div>
            <div style="font-size:1rem;color:#aaa;margin-top:8px;">P${winner + 1}이 먼저 맞췄어요!</div>
            <div style="color:#fdd34d;font-size:0.85rem;margin-top:4px;">정답: <b>${word.ko}</b></div>
          `);
        }
      },

      gameOver() {
        phase = 'gameover'; stopClassify();
        const maxScore = Math.max(0, ...Object.values(coord._scores));
        const isWinner = myScore === maxScore && myScore > 0;
        showOverlay(`
          <div style="font-size:2.5rem;">${isWinner ? '🏆' : '🎨'}</div>
          <div style="font-size:1.1rem;color:#fdd34d;margin-top:8px;">게임 종료</div>
          <div style="font-size:1.8rem;font-weight:bold;margin-top:6px;color:#fff;">점수: ${myScore}</div>
          ${isWinner && totalPlayers > 1 ? '<div style="color:#4ade80;font-size:0.85rem;margin-top:6px;">🥇 최고 점수!</div>' : ''}
        `);
        if (onGameOver) onGameOver(myScore);
      },
    });

    /* ── Load ml5 + DoodleNet ─────────────────────────────── */
    showOverlay(`<div style="font-size:0.95rem;color:#7ed3ff;line-height:1.6;">
      AI 모델 로딩 중...<br>
      <span style="font-size:0.78rem;color:#666;">처음 실행 시 5~10초 소요</span>
    </div>`);

    getClassifier()
      .then(clf  => { if (!dead) coord.setClassifier(clf); })
      .catch(err => {
        console.error('[drawing-game] Model load error:', err);
        if (!dead) showOverlay('<div style="color:#f87171;font-size:0.9rem;">AI 로딩 실패<br><span style="font-size:0.78rem;color:#888;">네트워크를 확인해 주세요</span></div>');
      });

    /* ── Resize ───────────────────────────────────────────── */
    resizeCanvas();
    const ro = new ResizeObserver(() => { if (!dead) resizeCanvas(); });
    ro.observe(canvasWrap);

    /* ── Destroy ──────────────────────────────────────────── */
    function destroy() {
      dead = true; stopClassify(); ro.disconnect(); container.innerHTML = '';
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

  /* Auto-preload model as soon as this script is loaded */
  getClassifier().catch(() => {});

})();
