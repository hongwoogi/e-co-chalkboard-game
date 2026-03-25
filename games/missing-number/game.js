'use strict';
/**
 * games/missing-number/game.js
 * "빠진 수 찾기" — Missing Number
 *
 * Gameplay:
 *  1. A number sequence appears with one slot hidden (❓).
 *  2. Tap the correct missing number from 4 choices.
 *  3. 10 rounds. Speed bonus for fast answers.
 *  4. Difficulty increases: consecutive → skip-counting by 2/5/10.
 */

(function registerMissingNumber() {

  /* ── Question generator ─────────────────────────────────────── */
  function makeQuestion(roundNum) {
    const scope = window.GradeScope?.get(
      window._gameSettings?.grade,
      window._gameSettings?.semester
    );

    let step, start;
    if (scope) {
      // Grade-scope mode
      const steps = scope.seqSteps;
      step = pick(steps);
      const maxStart = Math.max(1, Math.floor((scope.seqMax - step * 3) / step));
      start = rnd(1, maxStart) * step;
    } else if (roundNum <= 3) {
      step  = 1;
      start = rnd(1, 7);
    } else if (roundNum <= 7) {
      step  = 1;
      start = rnd(1, 17);
    } else {
      step  = pick([2, 5, 10]);
      const maxStart = { 2: 2, 5: 5, 10: 10 }[step];
      start = rnd(1, maxStart) * step;
    }

    const seq      = [start, start+step, start+2*step, start+3*step];
    const missIdx  = rnd(0, 3);
    const answer   = seq[missIdx];

    /* Three plausible distractors */
    const wrong = new Set();
    let attempts = 0;
    while (wrong.size < 3 && attempts++ < 200) {
      const offsets = [-step*2, -step, step, step*2, -1, 1, -2, 2];
      const w = answer + pick(offsets);
      if (w > 0 && w !== answer) wrong.add(w);
    }

    const choices = shuffle([answer, ...wrong]);
    return { seq, missIdx, answer, choices, step };
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function rnd(a, b)   { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr)   { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a)  { for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }

  const REACTIONS_OK  = ['🎉','⭐','✨','🌟','💫','👍','🥳'];
  const REACTIONS_BAD = ['😅','💨','🙈','😬','🫣'];
  const TOTAL_ROUNDS  = 10;
  const BASE_TIME     = 8000; // ms

  /* ── init ───────────────────────────────────────────────────── */
  function init(container, options) {
    const { playerIndex = 0, playerColor = '#7ed3ff', onGameOver } = options || {};

    let round = 0, score = 0, dead = false;
    let stepStart = 0, roundActive = false;
    let autoTimer = null;

    /* ── DOM ──────────────────────────────────────────────────── */
    container.innerHTML = '';
    container.style.cssText = `
      display:flex;flex-direction:column;height:100%;overflow:hidden;
      position:relative;background:#f7f3ee;
    `;

    /* Header */
    const header = el('div', `
      flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
      padding:8px 14px;background:rgba(0,0,0,0.06);border-bottom:2px solid rgba(0,0,0,0.08);
    `);
    const roundEl = el('div', `font-size:0.75rem;color:#888;font-family:var(--font-body);`);
    const scoreEl = el('div', `font-size:1rem;font-weight:bold;color:${playerColor};font-family:var(--font-display);`);
    header.append(roundEl, scoreEl);

    /* Timer bar */
    const timerWrap = el('div', `flex-shrink:0;height:6px;background:rgba(0,0,0,0.07);overflow:hidden;`);
    const timerFill = el('div', `height:100%;width:100%;background:${playerColor};transition:none;`);
    timerWrap.appendChild(timerFill);

    /* Sequence area */
    const seqArea = el('div', `
      flex-shrink:0;display:flex;align-items:center;justify-content:center;
      gap:clamp(6px,2vw,14px);padding:clamp(12px,3vh,24px) 12px 0;
    `);

    /* Reaction emoji */
    const reactionEl = el('div', `
      flex-shrink:0;text-align:center;font-size:clamp(2rem,6vw,3.5rem);
      min-height:clamp(2.5rem,7vw,4rem);line-height:1;padding:4px 0;
      transition:transform 0.15s;
    `);

    /* Choices */
    const choicesGrid = el('div', `
      flex:1;display:grid;grid-template-columns:1fr 1fr;
      gap:clamp(8px,2vw,16px);padding:clamp(8px,2vh,16px) clamp(12px,3vw,24px)
        calc(clamp(8px,2vh,16px) + env(safe-area-inset-bottom,0px));
      min-height:0;
    `);

    container.append(header, timerWrap, seqArea, reactionEl, choicesGrid);

    /* ── Round logic ──────────────────────────────────────────── */
    function startRound() {
      if (dead) return;
      round++;
      if (round > TOTAL_ROUNDS) { endGame(); return; }

      roundActive = true;
      stepStart = Date.now();
      const q = makeQuestion(round);

      /* Update header */
      roundEl.textContent = `${round} / ${TOTAL_ROUNDS} 라운드`;
      scoreEl.textContent = `${score}점`;
      reactionEl.textContent = '';

      /* Render sequence cards */
      seqArea.innerHTML = '';
      q.seq.forEach((num, i) => {
        const card = el('div', `
          min-width:clamp(40px,10vw,72px);height:clamp(44px,11vw,76px);
          display:flex;align-items:center;justify-content:center;
          border-radius:clamp(8px,2vw,16px);
          font-family:var(--font-display);font-size:clamp(1.2rem,3.5vw,2.2rem);
          font-weight:bold;user-select:none;
          ${i === q.missIdx
            ? `background:color-mix(in srgb,${playerColor} 20%,#f0ece5);
               border:3px dashed ${playerColor};color:${playerColor};
               animation:missingSpin 0.8s ease-out both;`
            : `background:color-mix(in srgb,${playerColor} 12%,#f0ece5);
               border:2px solid color-mix(in srgb,${playerColor} 35%,#c8b89a);
               color:#3d2b1f;`
          }
        `);
        card.textContent = i === q.missIdx ? '?' : num;
        seqArea.appendChild(card);

        /* Arrow between cards */
        if (i < 3) {
          const arr = el('div', `color:#aaa;font-size:clamp(0.9rem,2vw,1.4rem);flex-shrink:0;`);
          arr.textContent = '→';
          seqArea.appendChild(arr);
        }
      });

      /* Render choice buttons */
      choicesGrid.innerHTML = '';
      q.choices.forEach(val => {
        const btn = el('button', `
          display:flex;align-items:center;justify-content:center;
          border-radius:clamp(12px,2.5vw,20px);
          background:color-mix(in srgb,${playerColor} 22%,#f0ece5);
          border:3px solid color-mix(in srgb,${playerColor} 55%,#c8b89a);
          box-shadow:0 5px 0 color-mix(in srgb,${playerColor} 40%,#c8b89a);
          font-family:var(--font-display);font-size:clamp(1.4rem,4vw,2.5rem);
          font-weight:bold;color:#3d2b1f;cursor:pointer;
          touch-action:manipulation;user-select:none;
          transition:transform 0.07s,box-shadow 0.07s;
          min-height:0;
        `);
        btn.textContent = val;

        btn.addEventListener('pointerdown', () => {
          btn.style.transform = 'translateY(5px)';
          btn.style.boxShadow = '0 0 0 transparent';
        });
        btn.addEventListener('pointerup', () => {
          btn.style.transform = '';
          btn.style.boxShadow = '';
        });
        btn.addEventListener('click', () => onChoice(val, q.answer, q.choices));
        choicesGrid.appendChild(btn);
      });

      /* Timer countdown */
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        if (!roundActive) return;
        const elapsed = Date.now() - stepStart;
        const pct = Math.max(0, 1 - elapsed / BASE_TIME);
        timerFill.style.width = `${pct * 100}%`;
        timerFill.style.background = pct > 0.4 ? playerColor : '#f87171';
        if (pct <= 0) {
          clearInterval(autoTimer);
          onTimeout(q.answer, q.choices);
        }
      }, 50);
    }

    function onChoice(chosen, answer, choices) {
      if (!roundActive) return;
      roundActive = false;
      clearInterval(autoTimer);

      const correct = chosen === answer;
      if (correct) {
        const ms = Date.now() - stepStart;
        const timeBonus = Math.round(Math.max(0, (BASE_TIME - ms) / BASE_TIME) * 50);
        score += 100 + timeBonus;
        reactionEl.textContent = pick(REACTIONS_OK);
        reactionEl.style.transform = 'scale(1.4)';
        setTimeout(() => { reactionEl.style.transform = ''; }, 200);
        highlightChoices(chosen, answer, choices, '#4ade80');
      } else {
        reactionEl.textContent = pick(REACTIONS_BAD);
        highlightChoices(chosen, answer, choices, '#f87171');
      }

      scoreEl.textContent = `${score}점`;
      setTimeout(startRound, correct ? 900 : 1200);
    }

    function onTimeout(answer, choices) {
      if (!roundActive) return;
      roundActive = false;
      reactionEl.textContent = '⏰';
      highlightChoices(null, answer, choices, '#f87171');
      setTimeout(startRound, 1200);
    }

    function highlightChoices(chosen, answer, choices, wrongColor) {
      Array.from(choicesGrid.children).forEach((btn, i) => {
        const val = choices[i];
        if (val === answer) {
          btn.style.background = 'color-mix(in srgb,#4ade80 50%,#f0ece5)';
          btn.style.borderColor = '#4ade80';
          btn.style.boxShadow = '0 5px 0 #22c55e';
        } else if (val === chosen) {
          btn.style.background = 'color-mix(in srgb,#f87171 50%,#f0ece5)';
          btn.style.borderColor = '#f87171';
          btn.style.boxShadow = 'none';
          btn.style.animation = 'shake 0.35s ease-out';
        }
        btn.style.pointerEvents = 'none';
      });
    }

    function endGame() {
      dead = true;
      clearInterval(autoTimer);

      choicesGrid.innerHTML = '';
      seqArea.innerHTML = '';

      const msg = score >= 900 ? '🏆 완벽해요!' : score >= 600 ? '🌟 잘했어요!' : score >= 300 ? '😊 좋아요!' : '🔢 다시 도전!';
      const overlay = el('div', `
        position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:10px;
        background:rgba(247,243,238,0.96);
      `);
      overlay.innerHTML = `
        <div style="font-size:3rem;line-height:1;">${score >= 600 ? '🏆' : '🔢'}</div>
        <div style="font-family:var(--font-display);font-size:1rem;color:#888;">게임 종료</div>
        <div style="font-family:var(--font-display);font-size:2.5rem;font-weight:bold;color:${playerColor};">${score}점</div>
        <div style="font-family:var(--font-body);font-size:0.9rem;color:#aaa;">${msg}</div>
      `;
      container.appendChild(overlay);
      if (onGameOver) onGameOver(score);
    }

    /* ── Start ── */
    startRound();

    return { destroy() { dead = true; clearInterval(autoTimer); container.innerHTML = ''; } };
  }

  /* ── DOM helper ──────────────────────────────────────────────── */
  function el(tag, css) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    return e;
  }

  /* ── Inject ?-card animation ─────────────────────────────────── */
  if (!document.getElementById('mn-style')) {
    const s = document.createElement('style');
    s.id = 'mn-style';
    s.textContent = `
      @keyframes missingSpin {
        0%   { transform: scale(0.5) rotate(-15deg); opacity: 0; }
        60%  { transform: scale(1.2) rotate(5deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
    `;
    document.head.appendChild(s);
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['missing-number'] = { init };
})();
