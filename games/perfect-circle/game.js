'use strict';

/**
 * games/perfect-circle/game.js
 * "완벽한 원" — Draw a Perfect Circle
 *
 * Gameplay:
 *  1. Draw a circle with your finger/mouse.
 *  2. AI measures how close it is to a perfect circle.
 *  3. Score = roundness% × coverage_factor (0–100 points per round).
 *  4. 3 rounds, highest total wins.
 */

(function registerPerfectCircle() {

  /* ── Circle analysis ─────────────────────────────────────────── */
  function analyzeCircle(points) {
    if (points.length < 10) return null;

    /* Centroid */
    let cx = 0, cy = 0;
    for (const [x, y] of points) { cx += x; cy += y; }
    cx /= points.length; cy /= points.length;

    /* Radius of each point from centroid */
    const radii = points.map(([x, y]) => Math.hypot(x - cx, y - cy));
    const rAvg  = radii.reduce((s, r) => s + r, 0) / radii.length;
    if (rAvg < 15) return null; /* too small */

    /* Roundness: 1 - coefficient_of_variation */
    const rStd = Math.sqrt(radii.reduce((s, r) => s + (r - rAvg) ** 2, 0) / radii.length);
    const roundness = Math.max(0, 1 - rStd / rAvg);

    /* Coverage: how much of 360° is covered */
    const angles = points.map(([x, y]) => Math.atan2(y - cy, x - cx));
    angles.sort((a, b) => a - b);
    /* Largest gap between consecutive angles */
    let maxGap = 0;
    for (let i = 1; i < angles.length; i++) {
      maxGap = Math.max(maxGap, angles[i] - angles[i - 1]);
    }
    /* Wrap-around gap */
    maxGap = Math.max(maxGap, (angles[0] + Math.PI * 2) - angles[angles.length - 1]);
    const coverage = Math.max(0, 1 - maxGap / (Math.PI * 2));

    /* Combined score (weight roundness more) */
    const score = Math.round(roundness * 0.75 * 100 + coverage * 0.25 * 100);
    const pct   = Math.round(roundness * 100);

    let label, color;
    if (score >= 95)      { label = '🌟 완벽해요!';   color = '#4ade80'; }
    else if (score >= 85) { label = '🎯 훌륭해요!';   color = '#4ade80'; }
    else if (score >= 70) { label = '😊 좋아요!';     color = '#7ed3ff'; }
    else if (score >= 50) { label = '🙂 괜찮아요';    color = '#fdd34d'; }
    else if (score >= 30) { label = '😅 아쉬워요';    color = '#fd8863'; }
    else                  { label = '😔 다시 도전!';  color = '#f87171'; }

    return { cx, cy, rAvg, roundness, coverage, score, pct, label, color };
  }

  /* ── Coordinator ─────────────────────────────────────────────── */
  function createCoordinator(totalPlayers) {
    const TOTAL_ROUNDS = 3;
    let panels = [], started = false, currentRound = 0;
    let doneSet = new Set(), roundTimer = null;

    function broadcast(ev, data) { panels.forEach(p => p.cb[ev]?.(data)); }

    function startRound() {
      if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
      currentRound++;
      doneSet.clear();
      broadcast('roundStart', { round: currentRound, totalRounds: TOTAL_ROUNDS });
    }

    function endGame() { _c._gameover = true; broadcast('gameOver', {}); }

    const _c = {
      _gameover: false,
      _scores: {},

      register(playerIndex, cb) {
        panels.push({ playerIndex, cb });
        if (!started && panels.length >= totalPlayers) {
          started = true;
          setTimeout(startRound, 600);
        }
      },

      playerDone(playerIndex) {
        doneSet.add(playerIndex);
        if (doneSet.size >= totalPlayers) {
          clearTimeout(roundTimer);
          broadcast('allDone', {});
          setTimeout(startRound, 3500);
        } else {
          /* Wait up to 15s for others */
          clearTimeout(roundTimer);
          roundTimer = setTimeout(() => {
            broadcast('allDone', {});
            setTimeout(startRound, 3500);
          }, 15000);
        }
      },

      destroy() { clearTimeout(roundTimer); panels = []; },
    };
    return _c;
  }

  /* ── init() ──────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = '#7ed3ff', onGameOver } = options || {};
    const totalPlayers = window._gameSettings?.playerCount || 1;

    if (!window._CircleCoord || window._CircleCoord._gameover) {
      window._CircleCoord?.destroy();
      window._CircleCoord = createCoordinator(totalPlayers);
    }
    const coord = window._CircleCoord;

    let myScore = 0, phase = 'waiting', dead = false;
    let isDrawing = false, points = [];

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#f7f3ee;position:relative;';

    const header = el('div', {
      style: `flex-shrink:0;padding:10px 14px 8px;text-align:center;background:rgba(0,0,0,0.3);`,
    });
    const roundEl  = el('div', { style: `font-size:0.72rem;color:#7ed3ff;letter-spacing:1px;margin-bottom:4px;`, text: '준비 중...' });
    const scoreEl  = el('div', { style: `font-size:0.9rem;color:#fdd34d;font-weight:bold;`, text: '점수: 0' });
    header.append(roundEl, scoreEl);

    const canvasWrap = el('div', { style: `flex:1;position:relative;overflow:hidden;touch-action:none;cursor:crosshair;` });
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    canvasWrap.appendChild(canvas);

    const overlay = el('div', {
      style: `position:absolute;inset:0;display:none;flex-direction:column;
              align-items:center;justify-content:center;text-align:center;
              background:rgba(10,20,30,0.92);backdrop-filter:blur(4px);padding:20px;`,
    });
    canvasWrap.appendChild(overlay);

    const hintEl = el('div', {
      style: `flex-shrink:0;padding:6px;text-align:center;color:#555;font-size:0.75rem;background:rgba(0,0,0,0.2);`,
      text: '원을 그려보세요!',
    });

    container.append(header, canvasWrap, hintEl);

    /* ── Canvas ───────────────────────────────────────────────── */
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
      ctx.fillStyle = '#f7f3ee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      /* Guide circle outline */
      if (phase === 'drawing' || phase === 'waiting') {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const r  = Math.min(canvas.width, canvas.height) * 0.32;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    function getPos(e) {
      const r  = canvas.getBoundingClientRect();
      const sx = canvas.width  / r.width;
      const sy = canvas.height / r.height;
      const s  = e.touches ? e.touches[0] : e;
      return [(s.clientX - r.left) * sx, (s.clientY - r.top) * sy];
    }

    function onDown(e) {
      if (phase !== 'drawing') return;
      e.preventDefault();
      isDrawing = true;
      points = [];
      clearCanvas();
      const [x, y] = getPos(e);
      points.push([x, y]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = playerColor;
      ctx.lineWidth   = 6;
      ctx.lineCap = ctx.lineJoin = 'round';
    }

    function onMove(e) {
      if (!isDrawing || phase !== 'drawing') return;
      e.preventDefault();
      const [x, y] = getPos(e);
      points.push([x, y]);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function onUp(e) {
      if (!isDrawing) return;
      isDrawing = false;
      if (phase !== 'drawing') return;
      phase = 'done';

      const result = analyzeCircle(points);
      if (!result) {
        showOverlay(`
          <div style="font-size:2rem;">😕</div>
          <div style="font-size:1rem;color:#f87171;margin-top:8px;">원이 너무 작아요</div>
          <div style="font-size:0.85rem;color:#888;margin-top:4px;">더 크게 그려보세요!</div>
        `);
        setTimeout(() => {
          hideOverlay(); clearCanvas(); phase = 'drawing';
        }, 1500);
        return;
      }

      /* Draw the ideal circle */
      ctx.beginPath();
      ctx.arc(result.cx, result.cy, result.rAvg, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(253,211,77,0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      myScore += result.score;
      coord._scores[playerIndex] = myScore;
      scoreEl.textContent = `점수: ${myScore}`;

      showOverlay(`
        <div style="font-size:3rem;font-weight:bold;color:${result.color};">${result.pct}%</div>
        <div style="font-size:1.3rem;font-weight:bold;color:${result.color};margin-top:6px;">${result.label}</div>
        <div style="font-size:0.8rem;color:#888;margin-top:10px;">
          원형도 ${result.pct}% · 완성도 ${Math.round(result.coverage*100)}%
        </div>
        <div style="font-size:1.2rem;color:#fdd34d;margin-top:8px;">+${result.score}점</div>
      `);

      coord.playerDone(playerIndex);
    }

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('mouseleave', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove',  onMove, { passive: false });
    canvas.addEventListener('touchend',   onUp);

    /* ── Overlay helpers ──────────────────────────────────────── */
    function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; }
    function hideOverlay()     { overlay.style.display = 'none'; }

    /* ── Coordinator callbacks ────────────────────────────────── */
    coord.register(playerIndex, {
      roundStart({ round, totalRounds }) {
        phase = 'drawing';
        points = [];
        hideOverlay();
        resizeCanvas();
        clearCanvas();
        roundEl.textContent  = `${round} / ${totalRounds} 라운드`;
        hintEl.textContent   = '원을 그려보세요!';
      },

      allDone() {
        if (phase === 'drawing' || phase === 'done') phase = 'roundover';
      },

      gameOver() {
        phase = 'gameover';
        const maxScore = Math.max(0, ...Object.values(coord._scores));
        const isWinner = myScore === maxScore && myScore > 0;
        showOverlay(`
          <div style="font-size:2.5rem;">${isWinner ? '🏆' : '⭕'}</div>
          <div style="font-size:1rem;color:#fdd34d;margin-top:10px;">게임 종료</div>
          <div style="font-size:2rem;font-weight:bold;margin-top:8px;color:#1a1a2e;">총점: ${myScore}</div>
          ${isWinner && totalPlayers > 1 ? '<div style="color:#4ade80;font-size:0.85rem;margin-top:8px;">🥇 원의 달인!</div>' : ''}
        `);
        if (onGameOver) onGameOver(myScore);
      },
    });

    /* ── Resize ───────────────────────────────────────────────── */
    resizeCanvas();
    const ro = new ResizeObserver(() => { if (!dead) resizeCanvas(); });
    ro.observe(canvasWrap);

    function destroy() { dead = true; ro.disconnect(); container.innerHTML = ''; }
    return { destroy };
  }

  function el(tag, { style, text } = {}) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text)  e.textContent = text;
    return e;
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['perfect-circle'] = { init };
})();
