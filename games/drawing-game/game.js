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

  /* ── Quick Draw examples: stroke data for hint canvas ──────── */
  let _examples = null;
  function getExamples() {
    if (_examples) return Promise.resolve(_examples);
    return fetch('/games/drawing-game/examples.json')
      .then(r => r.json())
      .then(d => { _examples = d; return d; })
      .catch(() => ({}));
  }

  /* Draw Quick Draw stroke data onto a canvas element */
  function renderStrokesOnCanvas(strokes, canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!strokes?.length) return;

    /* Find bounding box */
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [xs, ys] of strokes) {
      for (let i = 0; i < xs.length; i++) {
        if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i];
        if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i];
      }
    }
    const pw = x1 - x0 || 1, ph = y1 - y0 || 1;
    const pad = 8;
    const scale = Math.min((canvas.width - pad * 2) / pw, (canvas.height - pad * 2) / ph);
    const ox = (canvas.width  - pw * scale) / 2 - x0 * scale;
    const oy = (canvas.height - ph * scale) / 2 - y0 * scale;

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = Math.max(2, canvas.width * 0.025);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const [xs, ys] of strokes) {
      ctx.beginPath();
      ctx.moveTo(xs[0] * scale + ox, ys[0] * scale + oy);
      for (let i = 1; i < xs.length; i++) {
        ctx.lineTo(xs[i] * scale + ox, ys[i] * scale + oy);
      }
      ctx.stroke();
    }
  }

  /* ── DoodleNet via TF.js direct — 28×28 grayscale model ───── */
  let _modelPromise = null;
  let _labels = null;

  function getModel() {
    if (_modelPromise) return _modelPromise;
    _modelPromise = new Promise((resolve, reject) => {
      function loadModel() {
        Promise.all([
          window.tf.loadLayersModel('/models/doodlenet/model.json'),
          fetch('/models/doodlenet/labels.json').then(r => r.json()),
        ]).then(([model, labels]) => {
          _labels = labels;
          resolve(model);
        }).catch(reject);
      }
      if (window.tf) {
        loadModel();
      } else {
        const s = document.createElement('script');
        s.src = '/js/tf.min.js';
        s.onload = loadModel;
        s.onerror = () => reject(new Error('TF.js load failed'));
        document.head.appendChild(s);
      }
    });
    return _modelPromise;
  }

  /* Classify a canvas element; returns [{label, confidence}] sorted desc */
  function classifyCanvas(model, canvas) {
    return window.tf.tidy(() => {
      /* Resize to 28×28 via offscreen canvas */
      const small = document.createElement('canvas');
      small.width = 28; small.height = 28;
      const sc = small.getContext('2d');
      sc.fillStyle = '#ffffff';
      sc.fillRect(0, 0, 28, 28);
      sc.drawImage(canvas, 0, 0, 28, 28);

      /* Build tensor: grayscale binary, invert (bg→0, stroke→1), shape [1,28,28,1] */
      const imgData = sc.getImageData(0, 0, 28, 28);
      const raw = imgData.data; // RGBA
      const gray = new Float32Array(28 * 28);
      for (let i = 0; i < 28 * 28; i++) {
        const r = raw[i * 4], g = raw[i * 4 + 1], b = raw[i * 4 + 2];
        const bright = (r + g + b) / 3;
        gray[i] = bright < 200 ? 1.0 : 0.0; // binary: dark stroke→1, light bg→0
      }

      const tensor = window.tf.tensor4d(gray, [1, 28, 28, 1]);
      const preds  = model.predict(tensor);
      const scores = preds.dataSync();

      return Array.from(scores)
        .map((confidence, i) => ({ label: _labels[i] || String(i), confidence }))
        .sort((a, b) => b.confidence - a.confidence);
    });
  }

  /* ── Coordinator: shared round state across all panels ──────── */
  function createCoordinator(totalPlayers, gameDuration) {
    const TOTAL_ROUNDS  = Math.max(3, Math.ceil(gameDuration / 15));
    const ROUND_SECONDS = 20;

    let panels = [], started = false, classifierReady = false, model = null;
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

      setClassifier(mdl) {
        model = mdl; classifierReady = true;
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
        if (!model || !canvas) return;
        try {
          const results = classifyCanvas(model, canvas);
          cb(null, results);
        } catch (e) { cb(e, null); }
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

    /* AI preview: shows the 28×28 image the model actually sees (scaled up) */
    const aiPreviewWrap = el('div', {
      style: `flex-shrink:0;padding:4px 12px 2px;background:#16213e;
              border-top:1px solid rgba(126,211,255,0.08);
              display:flex;align-items:center;gap:8px;`,
    });
    const aiPreviewLabel = el('span', {
      style: `font-size:0.65rem;color:#555;white-space:nowrap;`,
      text: 'AI가 보는 화면:',
    });
    const aiPreviewCanvas = document.createElement('canvas');
    aiPreviewCanvas.width  = 28;
    aiPreviewCanvas.height = 28;
    aiPreviewCanvas.style.cssText = `
      width:56px;height:56px;border:1px solid #333;border-radius:3px;
      image-rendering:pixelated;background:#000;
    `;
    aiPreviewWrap.append(aiPreviewLabel, aiPreviewCanvas);

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
    container.append(topBar, canvasWrap, aiPreviewWrap, botBar);

    /* ── Canvas drawing ───────────────────────────────────── */
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      const r = canvasWrap.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      if (canvas.width === w && canvas.height === h) return;

      /* Preserve existing drawing across resize */
      const prev = document.createElement('canvas');
      prev.width = canvas.width; prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = w; canvas.height = h;
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth   = Math.max(4, w * 0.018);
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      if (prev.width > 1 && prev.height > 1) {
        ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, w, h);
      }
    }

    function clearCanvas() {
      ctx.fillStyle = '#f7f3ea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth   = Math.max(4, canvas.width * 0.018);
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

    /* ── Canvas preprocessing: crop bounding box, return cropped canvas ── */
    /* TF.js classifyCanvas() handles the 28×28 resize + inversion */
    function getProcessedCanvas() {
      const idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = idata.data;
      let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (d[i] < 200 || d[i+1] < 200 || d[i+2] < 200) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 <= x0 || y1 <= y0 || (x1 - x0) < 5) return null;

      const pad  = Math.max(x1 - x0, y1 - y0) * 0.20;
      const srcX = Math.max(0,             Math.round(x0 - pad));
      const srcY = Math.max(0,             Math.round(y0 - pad));
      const srcX2 = Math.min(canvas.width, Math.round(x1 + pad));
      const srcY2 = Math.min(canvas.height,Math.round(y1 + pad));
      const srcW  = srcX2 - srcX;
      const srcH  = srcY2 - srcY;
      if (srcW < 5 || srcH < 5) return null;

      /* Return square-cropped canvas (white background, drawn content centered) */
      const size = Math.max(srcW, srcH);
      const tmp  = document.createElement('canvas');
      tmp.width  = size; tmp.height = size;
      const tc   = tmp.getContext('2d');
      tc.fillStyle = '#ffffff';
      tc.fillRect(0, 0, size, size);
      tc.drawImage(canvas, srcX, srcY, srcW, srcH,
        (size - srcW) / 2, (size - srcH) / 2, srcW, srcH);
      return tmp;
    }

    /* ── AI classification loop ───────────────────────────── */
    function startClassify() {
      stopClassify();
      classifyIv = setInterval(() => {
        if (dead || phase !== 'drawing') return;
        const word = coord.getCurrentWord();
        if (!word) return;

        const processed = getProcessedCanvas();
        /* Update AI preview: show exact binary image the model receives */
        if (processed) {
          const tmp = document.createElement('canvas');
          tmp.width = 28; tmp.height = 28;
          const tc = tmp.getContext('2d');
          tc.fillStyle = '#fff'; tc.fillRect(0,0,28,28);
          tc.drawImage(processed, 0, 0, 28, 28);
          const id = tc.getImageData(0,0,28,28);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) {
            const bright = (d[i]+d[i+1]+d[i+2])/3;
            const v = bright < 200 ? 0 : 255; // stroke=black, bg=white (human-readable)
            d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
          }
          tc.putImageData(id, 0, 0);
          aiPreviewCanvas.getContext('2d').drawImage(tmp, 0, 0);
        }
        coord.classify(processed, (err, results) => {
          if (err) { console.error('[DoodleNet]', err); return; }
          if (dead || phase !== 'drawing' || !results?.length) return;
          console.log('[DoodleNet top3]', results.slice(0,3).map(r=>r.label+'='+(r.confidence*100).toFixed(1)+'%').join(', '));
          updateBar(results, word);

          // Win condition: target in top-5 with sufficient confidence
          const match = results.slice(0, 5).find(
            r => r.label.toLowerCase() === word.en.toLowerCase() && r.confidence >= 0.18
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

        /* Show word + Quick Draw example hint */
        showOverlay(`
          <div style="font-size:0.85rem;color:#7ed3ff;margin-bottom:6px;">${round} / ${totalRounds} 라운드</div>
          <div style="font-size:2.2rem;font-weight:bold;color:#fdd34d;margin-bottom:6px;">${word.ko}</div>
          <canvas id="hint-canvas" width="100" height="100"
            style="border-radius:10px;background:#fff;margin-bottom:6px;"></canvas>
          <div style="font-size:0.75rem;color:#888;">이렇게 그려보세요!</div>
        `);
        /* Render example after DOM is updated */
        requestAnimationFrame(() => {
          const hc = overlay.querySelector('#hint-canvas');
          if (!hc) return;
          getExamples().then(ex => {
            const strokes = ex[word.en];
            if (strokes) renderStrokesOnCanvas(strokes, hc);
            else { hc.style.display = 'none'; }
          });
        });
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
      <span style="font-size:0.78rem;color:#666;">DoodleNet (28×28) 로컬 모델</span>
    </div>`);

    getModel()
      .then(mdl  => { if (!dead) coord.setClassifier(mdl); })
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
  getModel().catch(() => {});

})();
