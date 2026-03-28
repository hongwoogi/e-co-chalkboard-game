'use strict';

/**
 * games/reaction-speed/game.js
 * "반응속도" — Reaction Speed Game
 *
 * Gameplay:
 *  1. Screen shows a dark waiting state.
 *  2. After a random delay (2–5s), screen flashes bright green.
 *  3. Tap as fast as possible.
 *  4. Score = max(0, 1000 - reaction_ms). 5 rounds total.
 */

(function registerReactionSpeed() {

  function calcScore(ms) {
    const pts = Math.max(0, 1000 - Math.round(ms));
    let label, color;
    if (ms < 200)       { label = '⚡ 번개!';     color = '#4ade80'; }
    else if (ms < 300)  { label = '🎯 완벽!';     color = '#4ade80'; }
    else if (ms < 450)  { label = '👏 빠르다!';   color = '#7ed3ff'; }
    else if (ms < 650)  { label = '😊 좋아요!';   color = '#fdd34d'; }
    else if (ms < 900)  { label = '🙂 괜찮아요';  color = '#fd8863'; }
    else                { label = '🐢 느렸어요';   color = '#f87171'; }
    return { pts, label, color };
  }

  /* ── Coordinator ─────────────────────────────────────────────── */
  function createCoordinator(totalPlayers) {
    const TOTAL_ROUNDS = 5;
    let panels = [], started = false, currentRound = 0;
    let flashTimer = null, roundTimer = null, pressedSet = new Set();
    let flashedAt = 0, flashed = false;

    function broadcast(ev, data) { panels.forEach(p => p.cb[ev]?.(data)); }

    function startRound() {
      if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
      currentRound++;
      pressedSet.clear();
      flashed = false;
      broadcast('roundStart', { round: currentRound, totalRounds: TOTAL_ROUNDS });

      /* Random delay 2–5s before flash */
      const delay = 2000 + Math.random() * 3000;
      flashTimer = setTimeout(() => {
        flashedAt = Date.now();
        flashed = true;
        broadcast('flash', {});

        /* Auto-advance if nobody taps within 3s */
        roundTimer = setTimeout(() => {
          broadcast('roundOver', { flashedAt });
          setTimeout(startRound, 3000);
        }, 3000);
      }, delay);
    }

    function endGame() { _c._gameover = true; broadcast('gameOver', {}); }

    const _c = {
      _gameover: false,
      _scores: {},

      register(playerIndex, cb) {
        panels.push({ playerIndex, cb });
        if (!started && panels.length >= totalPlayers) {
          started = true;
          setTimeout(startRound, 800);
        }
      },

      playerTapped(playerIndex) {
        if (!flashed) return; /* too early — handled per-panel */
        pressedSet.add(playerIndex);
        if (pressedSet.size >= totalPlayers) {
          clearTimeout(roundTimer);
          broadcast('roundOver', { flashedAt });
          setTimeout(startRound, 3000);
        }
      },

      playerTappedEarly(playerIndex) {
        clearTimeout(flashTimer);
        clearTimeout(roundTimer);
        endGame();
      },

      isFlashed() { return flashed; },
      getFlashedAt() { return flashedAt; },
      destroy() { clearTimeout(flashTimer); clearTimeout(roundTimer); panels = []; },
    };
    return _c;
  }

  /* ── init() ──────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = '#4ade80', onGameOver } = options || {};
    const totalPlayers = window._gameSettings?.playerCount || 1;

    if (!window._ReactionCoord || window._ReactionCoord._gameover) {
      window._ReactionCoord?.destroy();
      window._ReactionCoord = createCoordinator(totalPlayers);
    }
    const coord = window._ReactionCoord;

    let myScore = 0, phase = 'waiting', dead = false, tooEarly = false, enabledAt = 0, pressedAt = 0;

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;background:#f7f3ee;transition:background 0.1s;';

    const header = el('div', {
      style: `flex-shrink:0;padding:10px 14px 8px;text-align:center;background:rgba(0,0,0,0.3);`,
    });
    const roundEl = el('div', { style: `font-size:0.72rem;color:#7ed3ff;letter-spacing:1px;margin-bottom:4px;`, text: '⚡ 준비 중...' });
    const scoreEl = el('div', { style: `font-size:0.9rem;color:#fdd34d;font-weight:bold;`, text: '점수: 0' });
    header.append(roundEl, scoreEl);

    const center = el('div', {
      style: `flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;`,
    });

    const msgEl = el('div', {
      style: `font-size:1.6rem;font-weight:bold;color:#1a1a2e;text-align:center;line-height:1.4;`,
      text: '곧 시작해요...',
    });

    const tapBtn = el('button', {
      style: `width:80%;max-width:240px;padding:28px 0;font-size:2rem;font-weight:bold;
              background:rgba(0,0,0,0.08);color:rgba(20,20,40,0.3);
              border:3px solid rgba(0,0,0,0.12);border-radius:24px;cursor:pointer;
              font-family:var(--font-body);transition:all 0.1s;letter-spacing:1px;`,
      text: '탭!',
    });
    tapBtn.disabled = true;

    const timeEl = el('div', { style: `font-size:0.85rem;color:#555;`, text: '' });
    center.append(msgEl, tapBtn, timeEl);

    const overlay = el('div', {
      style: `position:absolute;inset:0;display:none;flex-direction:column;
              align-items:center;justify-content:center;text-align:center;
              background:rgba(10,20,30,0.92);backdrop-filter:blur(4px);padding:20px;`,
    });

    container.append(header, center, overlay);

    /* ── Helpers ──────────────────────────────────────────────── */
    function setWaiting() {
      container.style.background = '#f7f3ee';
      tapBtn.disabled = true;
      tapBtn.style.background = 'rgba(0,0,0,0.07)';
      tapBtn.style.color = 'rgba(0,0,0,0.3)';
      tapBtn.style.borderColor = 'rgba(0,0,0,0.15)';
      tapBtn.style.boxShadow = '0 5px 0 rgba(0,0,0,0.2)';
    }

    /* Track when the user's finger/mouse first pressed the button */
    tapBtn.addEventListener('pointerdown', () => { pressedAt = performance.now(); });

    function setFlash() {
      container.style.background = '#d4f0d4';
      tapBtn.disabled = false;
      enabledAt = performance.now();
      tapBtn.style.background = `linear-gradient(135deg,${playerColor},color-mix(in srgb,${playerColor} 60%,#000))`;
      tapBtn.style.color = '#1a1a2e';
      tapBtn.style.borderColor = playerColor;
      tapBtn.style.boxShadow = `0 0 40px color-mix(in srgb,${playerColor} 50%,transparent)`;
    }

    function showOverlay(html) { overlay.innerHTML = html; overlay.style.display = 'flex'; }
    function hideOverlay()     { overlay.style.display = 'none'; }

    /* ── Button tap ───────────────────────────────────────────── */
    tapBtn.addEventListener('click', () => {
      if (phase === 'waiting_flash') {
        /* Tapped too early — end game immediately */
        tooEarly = true;
        phase = 'too_early';
        dead = true;
        setWaiting();
        msgEl.textContent = '너무 일찍!';
        msgEl.style.color = '#f87171';
        tapBtn.disabled = true;
        timeEl.textContent = '';
        coord.playerTappedEarly(playerIndex);
        return;
      }
      if (phase !== 'flash' || dead) return;
      /* Reject if the press started before the flash (finger was already on button) */
      if (pressedAt < enabledAt) return;

      const ms = Date.now() - coord.getFlashedAt();
      const result = calcScore(ms);
      myScore += result.pts;
      coord._scores[playerIndex] = myScore;
      scoreEl.textContent = `점수: ${myScore}`;

      phase = 'pressed';
      tapBtn.disabled = true;
      showOverlay(`
        <div style="font-size:1rem;color:#888;margin-bottom:8px;">반응속도</div>
        <div style="font-size:3rem;font-weight:bold;color:#1a1a2e;">${ms}ms</div>
        <div style="font-size:1.5rem;font-weight:bold;color:${result.color};margin-top:8px;">${result.label}</div>
        <div style="font-size:1.2rem;color:${result.color};margin-top:4px;">+${result.pts}점</div>
      `);

      coord.playerTapped(playerIndex);
    });

    /* ── Coordinator callbacks ────────────────────────────────── */
    coord.register(playerIndex, {
      roundStart({ round, totalRounds }) {
        phase = 'waiting_flash';
        tooEarly = false;
        setWaiting();
        hideOverlay();
        roundEl.textContent = `${round} / ${totalRounds} 라운드`;
        msgEl.textContent = '초록불이 켜지면\n탭!';
        msgEl.style.color = '#1a1a2e';
        timeEl.textContent = '기다려요...';
      },

      flash() {
        if (tooEarly) return;
        phase = 'flash';
        setFlash();
        msgEl.textContent = '지금!';
        msgEl.style.color = '#4ade80';
        timeEl.textContent = '';
      },

      roundOver({ flashedAt: fa }) {
        if (phase !== 'pressed') {
          /* didn't tap in time */
          phase = 'roundover';
          setWaiting();
          const penalty = tooEarly ? '너무 일찍 눌렀어요' : '시간이 지났어요';
          showOverlay(`
            <div style="font-size:2rem;">⏰</div>
            <div style="font-size:1rem;color:#f87171;margin-top:8px;">${penalty}</div>
            <div style="font-size:0.9rem;color:#888;margin-top:4px;">+0점</div>
          `);
        }
        phase = 'roundover';
      },

      gameOver() {
        phase = 'gameover';
        const maxScore = Math.max(0, ...Object.values(coord._scores));
        const isWinner = myScore === maxScore && myScore > 0;
        const earlyOut = tooEarly;
        showOverlay(earlyOut ? `
          <div style="font-size:2.5rem;">🚫</div>
          <div style="font-size:1.1rem;color:#f87171;margin-top:10px;font-weight:bold;">너무 일찍 눌렀어요!</div>
          <div style="font-size:0.9rem;color:#888;margin-top:6px;">초록불이 켜질 때까지 기다려야 해요</div>
          <div style="font-size:1.8rem;font-weight:bold;margin-top:12px;color:#1a1a2e;">총점: ${myScore}</div>
        ` : `
          <div style="font-size:2.5rem;">${isWinner ? '🏆' : '⚡'}</div>
          <div style="font-size:1rem;color:#fdd34d;margin-top:10px;">게임 종료</div>
          <div style="font-size:2rem;font-weight:bold;margin-top:8px;color:#1a1a2e;">총점: ${myScore}</div>
          ${isWinner && totalPlayers > 1 ? '<div style="color:#4ade80;font-size:0.85rem;margin-top:8px;">🥇 가장 빠른 반응!</div>' : ''}
        `);
        if (onGameOver) onGameOver(myScore);
      },
    });

    function destroy() { dead = true; container.innerHTML = ''; }
    return { destroy };
  }

  function el(tag, { style, text } = {}) {
    const e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text)  e.textContent = text;
    return e;
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['reaction-speed'] = { init };
})();
