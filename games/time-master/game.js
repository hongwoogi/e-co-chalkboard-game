'use strict';

/**
 * games/time-master/game.js
 * "시간 지배자" — Time Sense Game
 *
 * Gameplay:
 *  1. A target integer time (10–15s) is shown.
 *  2. Stopwatch starts from 0; display fades to black over 5 seconds.
 *  3. Player presses [지금!] when they think the target time has elapsed.
 *  4. Closer to target = more points. 5 rounds total.
 */

(function registerTimeMaster() {

  /* ── Scoring: 1000pts - 10pts per 0.01s of error ──────────── */
  function calcScore(diff) {
    const pts = Math.max(0, 1000 - Math.floor(diff * 20) * 10);
    let label, color;
    if (pts >= 950) { label = '🎯 완벽!';      color = '#4ade80'; }
    else if (pts >= 800) { label = '👏 훌륭해요!'; color = '#4ade80'; }
    else if (pts >= 600) { label = '😊 좋아요!';   color = '#7ed3ff'; }
    else if (pts >= 400) { label = '🙂 괜찮아요';  color = '#fdd34d'; }
    else if (pts >= 100) { label = '😅 아쉬워요';  color = '#fd8863'; }
    else                 { label = '😔 다시 도전!'; color = '#f87171'; }
    return { pts, label, color };
  }

  /* ── Coordinator: syncs target & round start across panels ── */
  function createCoordinator(totalPlayers) {
    const TOTAL_ROUNDS     = 5;
    const TARGET_MIN       = 10;
    const TARGET_MAX       = 15;
    const TIMEOUT_AFTER    = 6; // extra seconds after target before auto-advance

    let panels = [], currentRound = 0, target = 0, started = false;
    let startedAt = 0, roundTimer = null, pressedSet = new Set();

    function broadcast(ev, data) { panels.forEach(p => p.cb[ev]?.(data)); }

    function pickTarget() {
      return TARGET_MIN + Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1));
    }

    function startRound() {
      if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
      currentRound++;
      target = pickTarget();
      pressedSet.clear();

      broadcast('roundStart', { round: currentRound, totalRounds: TOTAL_ROUNDS, target });

      let cnt = 3;
      broadcast('countdown', { count: cnt });
      const tick = setInterval(() => {
        cnt--;
        if (cnt > 0) {
          broadcast('countdown', { count: cnt });
        } else {
          clearInterval(tick);
          startedAt = Date.now();
          broadcast('go', { target, startedAt });

          // Auto-advance if not all players press in time
          roundTimer = setTimeout(() => {
            broadcast('roundOver', { target });
            setTimeout(startRound, 4000);
          }, (target + TIMEOUT_AFTER) * 1000);
        }
      }, 1000);
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

      playerPressed(playerIndex) {
        pressedSet.add(playerIndex);
        if (pressedSet.size >= totalPlayers) {
          clearTimeout(roundTimer);
          broadcast('roundOver', { target });
          setTimeout(startRound, 4000);
        }
      },

      destroy() { clearTimeout(roundTimer); panels = []; },
    };

    return _c;
  }

  /* ── init() ─────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = 'var(--primary)', onGameOver } = options || {};
    const totalPlayers = window._gameSettings?.playerCount || 1;

    if (!window._TimeCoord || window._TimeCoord._gameover) {
      window._TimeCoord?.destroy();
      window._TimeCoord = createCoordinator(totalPlayers);
    }
    const coord = window._TimeCoord;

    /* ── State ────────────────────────────────────────────────── */
    let myScore = 0, phase = 'waiting', startedAt = 0, target = 0;
    let animFrame = null, dead = false, hasPressed = false;

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;background:#0f0f1a;position:relative;';

    /* Header: round info + target */
    const header = el('div', {
      style: `flex-shrink:0;padding:10px 14px 8px;background:#0a0a18;
              border-bottom:1px solid rgba(253,211,77,0.12);text-align:center;`,
    });
    const roundEl = el('div', {
      style: `font-size:0.72rem;color:#7ed3ff;letter-spacing:1px;margin-bottom:4px;`,
      text: '⏳ 준비 중...',
    });
    const targetEl = el('div', {
      style: `font-size:2rem;font-weight:bold;color:#fdd34d;letter-spacing:2px;`,
      text: '— 초',
    });
    header.append(roundEl, targetEl);

    /* Center: stopwatch + visibility bar + button */
    const center = el('div', {
      style: `flex:1;display:flex;flex-direction:column;align-items:center;
              justify-content:center;gap:18px;padding:12px 16px;`,
    });

    /* Stopwatch digits */
    const swEl = el('div', {
      style: `font-size:4rem;font-weight:bold;color:#ffffff;
              font-family:var(--font-display);letter-spacing:4px;
              text-shadow:0 0 30px rgba(253,211,77,0.3);`,
      text: '0.00',
    });

    /* Visibility bar */
    const visWrap = el('div', { style: `width:85%;` });
    const visLabelEl = el('div', {
      style: `font-size:0.7rem;color:#555;text-align:center;margin-bottom:5px;`,
      text: '화면 가시성',
    });
    const visTrack = el('div', {
      style: `height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;`,
    });
    const visFill = el('div', {
      style: `height:100%;width:100%;background:#7ed3ff;border-radius:4px;`,
    });
    visTrack.appendChild(visFill);
    visWrap.append(visLabelEl, visTrack);

    /* [지금!] button */
    const nowBtn = el('button', {
      style: `width:75%;max-width:220px;padding:18px 0;
              font-size:1.6rem;font-weight:bold;
              background:linear-gradient(135deg,#fdd34d,#f59e0b);
              color:#1a1008;border:none;border-radius:20px;cursor:pointer;
              font-family:var(--font-body);
              box-shadow:0 6px 24px rgba(253,211,77,0.35);
              transition:transform 0.08s,box-shadow 0.08s,opacity 0.2s;
              opacity:0.35;`,
      text: '지금!',
    });
    nowBtn.disabled = true;

    nowBtn.addEventListener('pointerdown', () => {
      if (!nowBtn.disabled) {
        nowBtn.style.transform = 'scale(0.94)';
        nowBtn.style.boxShadow = '0 2px 10px rgba(253,211,77,0.2)';
      }
    });
    nowBtn.addEventListener('pointerup', () => {
      nowBtn.style.transform = '';
      nowBtn.style.boxShadow = '0 6px 24px rgba(253,211,77,0.35)';
    });

    center.append(swEl, visWrap, nowBtn);

    /* Footer: score */
    const footer = el('div', {
      style: `flex-shrink:0;padding:6px 16px;background:#0a0a18;
              border-top:1px solid rgba(253,211,77,0.1);
              display:flex;align-items:center;justify-content:space-between;`,
    });
    const scoreEl  = el('span', { style: `color:#fdd34d;font-size:0.9rem;font-weight:bold;`, text: '점수: 0' });
    const hintEl   = el('span', { style: `color:#555;font-size:0.75rem;`, text: '5초 후 화면이 꺼져요' });
    footer.append(scoreEl, hintEl);

    /* Result overlay (covers full container) */
    const overlay = el('div', {
      style: `position:absolute;inset:0;display:none;flex-direction:column;
              align-items:center;justify-content:center;text-align:center;
              background:rgba(10,10,26,0.93);backdrop-filter:blur(4px);padding:20px;`,
    });

    container.append(header, center, footer, overlay);

    /* ── Animation loop ───────────────────────────────────────── */
    const FADE_DURATION = 5; // seconds

    function tick() {
      if (dead || phase !== 'running') return;
      const elapsed = (Date.now() - startedAt) / 1000;

      /* Stopwatch display */
      swEl.textContent = elapsed.toFixed(2);

      /* Fade over FADE_DURATION seconds */
      const vis = Math.max(0, 1 - elapsed / FADE_DURATION);
      swEl.style.opacity = vis;

      /* Visibility bar */
      visFill.style.width = `${vis * 100}%`;
      if      (vis > 0.55) { visFill.style.background = '#7ed3ff'; visLabelEl.style.color = '#555'; }
      else if (vis > 0.20) { visFill.style.background = '#fdd34d'; visLabelEl.style.color = '#fdd34d'; }
      else                 { visFill.style.background = '#f87171'; visLabelEl.style.color = '#f87171'; }

      animFrame = requestAnimationFrame(tick);
    }

    function startAnim()   { animFrame = requestAnimationFrame(tick); }
    function stopAnim()    { if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; } }

    function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; }

    /* ── Button press ─────────────────────────────────────────── */
    nowBtn.addEventListener('click', () => {
      if (phase !== 'running' || hasPressed) return;
      hasPressed = true;
      phase = 'pressed';
      stopAnim();

      const elapsed = (Date.now() - startedAt) / 1000;
      const diff    = Math.abs(elapsed - target);
      const timing  = elapsed >= target ? `+${(elapsed - target).toFixed(2)}초 늦게` : `-${(target - elapsed).toFixed(2)}초 일찍`;
      const result  = calcScore(diff);

      myScore += result.pts;
      coord._scores[playerIndex] = myScore;
      scoreEl.textContent = `점수: ${myScore}`;

      nowBtn.disabled = true;
      nowBtn.style.opacity = '0.3';

      showOverlay(`
        <div style="font-size:0.8rem;color:#888;margin-bottom:10px;">목표: ${target}초</div>
        <div style="font-size:2rem;font-weight:bold;color:#fff;margin-bottom:4px;">${elapsed.toFixed(2)}초</div>
        <div style="font-size:0.85rem;color:#888;margin-bottom:14px;">${timing} · 오차 ${diff.toFixed(2)}초</div>
        <div style="font-size:1.6rem;font-weight:bold;color:${result.color};">${result.label}</div>
        <div style="font-size:1.3rem;color:${result.color};margin-top:6px;">+${result.pts}점</div>
      `);

      coord.playerPressed(playerIndex);
    });

    /* ── Coordinator callbacks ─────────────────────────────────── */
    coord.register(playerIndex, {

      roundStart({ round, totalRounds, target: t }) {
        phase = 'countdown';
        target = t; hasPressed = false;
        stopAnim();

        swEl.textContent = '0.00';
        swEl.style.opacity = '1';
        swEl.style.fontSize = '4rem';
        visFill.style.width = '100%';
        visFill.style.background = '#7ed3ff';
        visLabelEl.style.color = '#555';
        nowBtn.disabled = true;
        nowBtn.style.opacity = '0.35';
        overlay.style.display = 'none';

        roundEl.textContent  = `${round} / ${totalRounds} 라운드`;
        targetEl.textContent = `${t}초`;
      },

      countdown({ count }) {
        swEl.textContent  = count;
        swEl.style.opacity = '1';
        swEl.style.fontSize = count === 1 ? '5rem' : '4rem';
      },

      go({ target: t, startedAt: sat }) {
        phase = 'running';
        target = t; startedAt = sat;
        swEl.textContent = '0.00';
        swEl.style.fontSize = '4rem';
        nowBtn.disabled = false;
        nowBtn.style.opacity = '1';
        hintEl.textContent = '5초 후 화면이 꺼져요';
        startAnim();
      },

      roundOver({ target: t }) {
        /* For players who didn't press, show miss message */
        if (!hasPressed) {
          hasPressed = true;
          stopAnim();
          nowBtn.disabled = true;
          nowBtn.style.opacity = '0.3';
          showOverlay(`
            <div style="font-size:0.8rem;color:#888;margin-bottom:10px;">목표: ${t}초</div>
            <div style="font-size:1.5rem;color:#f87171;margin-bottom:8px;">시간이 지났어요</div>
            <div style="font-size:1rem;color:#888;">+0점</div>
          `);
        }
        phase = 'roundover';
      },

      gameOver() {
        phase = 'gameover';
        stopAnim();
        nowBtn.disabled = true;
        nowBtn.style.opacity = '0.3';
        const maxScore = Math.max(0, ...Object.values(coord._scores));
        const isWinner = myScore === maxScore && myScore > 0;
        showOverlay(`
          <div style="font-size:2.5rem;">${isWinner ? '🏆' : '⏱️'}</div>
          <div style="font-size:1rem;color:#fdd34d;margin-top:10px;">게임 종료</div>
          <div style="font-size:2rem;font-weight:bold;margin-top:8px;color:#fff;">총점: ${myScore}</div>
          ${isWinner && totalPlayers > 1 ? '<div style="color:#4ade80;font-size:0.85rem;margin-top:8px;">🥇 시간 지배자!</div>' : ''}
        `);
        if (onGameOver) onGameOver(myScore);
      },
    });

    /* ── Destroy ──────────────────────────────────────────────── */
    function destroy() {
      dead = true; stopAnim(); container.innerHTML = '';
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
  window.GameModules['time-master'] = { init };

})();
