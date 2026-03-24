'use strict';
/**
 * games/times-quiz/game.js
 * "구구단 배틀" — Multiplication Quiz (선착순 버저 방식)
 *
 * A multiplication problem is shown at the top for all players.
 * Each player has 4 choice buttons (A/B/C/D).
 * First player to tap the correct answer gets +15 pts.
 * Wrong answer = 2s lock for that player.
 * No answer in 10s = show answer, next question.
 * Range: 2단~9단 (2×2 to 9×9)
 */

(function registerTimesQuiz() {

  // Build full question set: all facts 2×2 to 9×9
  const FACTS = [];
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      FACTS.push({ q: `${a} × ${b}`, a, b, answer: a * b });
    }
  }

  function init(container, options) {
    const { playerCount = 2, playerColors = [], onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    const LABELS     = ['P1','P2','P3','P4'];
    const POINTS_WIN = 15;
    const Q_TIMEOUT  = 10;

    let scores    = new Array(playerCount).fill(0);
    let locked    = new Array(playerCount).fill(false);
    let timeLeft  = gameDuration;
    let qTimer    = Q_TIMEOUT;
    let isGameOver    = false;
    let gameTimerH    = null, qTimerH = null;
    let currentQ      = null;
    let answerRevealed = false;
    let questionNum   = 0;

    const pool = [...FACTS].sort(() => Math.random() - 0.5);
    let poolIdx = 0;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex; flex-direction: column; height: 100%;
      overflow: hidden; background:#f7f3ee; font-family: var(--font-body);
    `;

    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.3em 0.8em; background: rgba(0,0,0,0.3); flex-shrink: 0;
    `;
    topBar.innerHTML = `
      <span id="tq-qnum" style="color:#aaa;font-size:var(--text-sm);">문제 1</span>
      <span id="tq-qtimer" style="font-family:var(--font-display);font-size:var(--text-xl);color:#fdd835;">${Q_TIMEOUT}</span>
      <span id="tq-timer" style="color:#aaa;font-size:var(--text-sm);">⏱ ${gameDuration}s</span>
    `;
    container.appendChild(topBar);

    const qArea = document.createElement('div');
    qArea.style.cssText = `
      flex: 0 0 auto; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 0.4em; min-height: 0; gap: 0.2em;
    `;
    qArea.innerHTML = `
      <div style="font-family:var(--font-body);font-size:clamp(0.9rem,2vmin,1.2rem);color:#aaa;">= ?</div>
      <div id="tq-question" style="font-family:var(--font-display);font-size:clamp(2.5rem,10vmin,6rem);color:#fff;line-height:1;letter-spacing:0.05em;"></div>
      <div id="tq-answer-reveal" style="font-family:var(--font-display);font-size:clamp(1.2rem,3.5vmin,2rem);color:#fdd835;min-height:1.5em;text-align:center;"></div>
    `;
    container.appendChild(qArea);

    const zonesRow = document.createElement('div');
    zonesRow.style.cssText = `
      display: flex; flex: 1; min-height: 0;
      gap: 3px; padding: 3px; background: rgba(0,0,0,0.4);
    `;
    container.appendChild(zonesRow);

    const playerBtns = [];

    for (let p = 0; p < playerCount; p++) {
      const color = playerColors[p] || '#fff';
      const zone = document.createElement('div');
      zone.style.cssText = `flex:1;display:flex;flex-direction:column;gap:3px;overflow:hidden;border-top:3px solid ${color};`;

      const header = document.createElement('div');
      header.style.cssText = `
        text-align:center; font-family:var(--font-display);
        font-size:clamp(0.8rem,2.5vmin,1.3rem); padding:0.2em;
        background:color-mix(in srgb,${color} 20%,rgba(0,0,0,0.5)); border-radius:4px; flex-shrink:0;
      `;
      header.innerHTML = `<span style="color:${color};">${LABELS[p]}</span> <span id="tq-score-${p}" style="color:#fff;">0점</span>`;
      zone.appendChild(header);

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;flex:1;min-height:0;';

      const pBtns = [];
      ['A','B','C','D'].forEach((label, ci) => {
        const btn = document.createElement('button');
        btn.dataset.playerColor = color;
        btn.style.cssText = `
          border: 2.5px solid color-mix(in srgb,${color} 50%,rgba(255,255,255,0.1));
          border-radius: 1.2em;
          background: color-mix(in srgb,${color} 8%,rgba(255,255,255,0.05));
          color: #fff;
          font-family: var(--font-display);
          font-size: clamp(1.2rem,3.5vmin,2.2rem);
          cursor: pointer;
          touch-action: manipulation;
          user-select: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 4px;
          overflow: hidden;
          transition: background 0.15s, transform 0.1s;
          line-height: 1.2;
        `;
        btn.innerHTML = `<span style="opacity:0.5;font-size:0.8em;">${label}</span><span class="choice-text"></span>`;

        const onTap = (e) => {
          e.preventDefault();
          if (isGameOver || locked[p] || answerRevealed) return;
          handleAnswer(p, ci);
        };
        btn.addEventListener('touchstart', onTap, { passive: false });
        btn.addEventListener('click', onTap);
        grid.appendChild(btn);
        pBtns.push(btn);
      });

      playerBtns.push(pBtns);
      zone.appendChild(grid);
      zonesRow.appendChild(zone);
    }

    /* ── Refs ── */
    const questionEl  = container.querySelector('#tq-question');
    const qtimerEl    = container.querySelector('#tq-qtimer');
    const gameTimerEl = container.querySelector('#tq-timer');
    const revealEl    = container.querySelector('#tq-answer-reveal');
    const qnumEl      = container.querySelector('#tq-qnum');

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function updateScores() {
      for (let p = 0; p < playerCount; p++) {
        const el = container.querySelector(`#tq-score-${p}`);
        if (el) el.textContent = `${scores[p]}점`;
      }
    }

    function setAllBtnsEnabled(enabled) {
      playerBtns.forEach((pBtns, p) => {
        if (locked[p]) return;
        pBtns.forEach(btn => {
          btn.style.opacity = enabled ? '1' : '0.5';
          btn.style.pointerEvents = enabled ? '' : 'none';
        });
      });
    }

    function nextQuestion() {
      if (isGameOver) return;
      answerRevealed = false;
      locked.fill(false);
      revealEl.textContent = '';

      playerBtns.forEach(pBtns => pBtns.forEach(btn => {
        const c = btn.dataset.playerColor || '#fff';
        btn.style.background  = `color-mix(in srgb,${c} 8%,rgba(255,255,255,0.05))`;
        btn.style.borderColor = `color-mix(in srgb,${c} 50%,rgba(255,255,255,0.1))`;
        btn.style.opacity = '1'; btn.style.pointerEvents = '';
        btn.style.transform = '';
      }));

      if (poolIdx >= pool.length) { pool.sort(() => Math.random() - 0.5); poolIdx = 0; }
      currentQ = pool[poolIdx++];
      questionNum++;

      // 3 wrong answers: nearby values ±1..±5, avoid duplicates
      const wrongSet = new Set();
      while (wrongSet.size < 3) {
        const delta = (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? 1 : -1);
        const w = currentQ.answer + delta;
        if (w > 0 && w !== currentQ.answer) wrongSet.add(w);
      }
      const choices = shuffle([currentQ.answer, ...wrongSet]);
      currentQ.choices    = choices;
      currentQ.correctIdx = choices.indexOf(currentQ.answer);

      questionEl.textContent = currentQ.q;
      qnumEl.textContent     = `문제 ${questionNum}`;

      playerBtns.forEach(pBtns => {
        pBtns.forEach((btn, ci) => {
          btn.querySelector('.choice-text').textContent = choices[ci];
        });
      });

      qTimer = Q_TIMEOUT;
      qtimerEl.textContent = qTimer;
      qtimerEl.style.color = '#fdd835';

      clearInterval(qTimerH);
      qTimerH = setInterval(() => {
        qTimer--;
        qtimerEl.textContent = qTimer;
        if (qTimer <= 3) qtimerEl.style.color = '#ff5252';
        if (qTimer <= 0) { clearInterval(qTimerH); timeoutQuestion(); }
      }, 1000);
    }

    function timeoutQuestion() {
      if (isGameOver) return;
      answerRevealed = true;
      revealEl.textContent = `정답: ${currentQ.answer}`;
      setAllBtnsEnabled(false);
      playerBtns.forEach(pBtns => {
        pBtns[currentQ.correctIdx].style.background  = 'rgba(100,200,100,0.4)';
        pBtns[currentQ.correctIdx].style.borderColor = '#66bb6a';
      });
      setTimeout(nextQuestion, 2200);
    }

    function handleAnswer(playerIdx, choiceIdx) {
      clearInterval(qTimerH);
      const correct = choiceIdx === currentQ.correctIdx;
      const btn = playerBtns[playerIdx][choiceIdx];

      if (correct) {
        window.SoundEngine?.play("correct");
        answerRevealed = true;
        scores[playerIdx] += POINTS_WIN;
        btn.style.background  = 'rgba(100,220,100,0.5)';
        btn.style.borderColor = '#66bb6a';
        btn.style.transform   = 'scale(1.05)';
        revealEl.textContent  = `✅ ${LABELS[playerIdx]} 정답! +${POINTS_WIN}점`;
        revealEl.style.color  = '#fdd835';
        updateScores();
        setAllBtnsEnabled(false);
        playerBtns.forEach((pBtns, p) => {
          if (p !== playerIdx) {
            pBtns[currentQ.correctIdx].style.background  = 'rgba(100,200,100,0.2)';
            pBtns[currentQ.correctIdx].style.borderColor = '#66bb6a';
          }
        });
        setTimeout(nextQuestion, 1800);
      } else {
        btn.style.background  = 'rgba(220,80,80,0.4)';
        btn.style.borderColor = '#ef5350';
        window.SoundEngine?.play("wrong");
        locked[playerIdx] = true;
        playerBtns[playerIdx].forEach(b => { b.style.opacity = '0.4'; b.style.pointerEvents = 'none'; });
        setTimeout(() => {
          if (isGameOver) return;
          locked[playerIdx] = false;
          playerBtns[playerIdx].forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; });
          btn.style.background  = 'rgba(255,255,255,0.08)';
          btn.style.borderColor = 'rgba(255,255,255,0.2)';
        }, 2000);
        qTimerH = setInterval(() => {
          qTimer--;
          qtimerEl.textContent = qTimer;
          if (qTimer <= 3) qtimerEl.style.color = '#ff5252';
          if (qTimer <= 0) { clearInterval(qTimerH); timeoutQuestion(); }
        }, 1000);
      }
    }

    function startTimers() {
      gameTimerH = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        gameTimerEl.textContent = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    function endGame() {
      isGameOver = true;
      clearInterval(gameTimerH);
      clearInterval(qTimerH);

      const scoreList = scores.map((s, i) => ({ playerIndex: i, score: s }));
      const sorted    = [...scoreList].sort((a, b) => b.score - a.score);
      const trophy    = sorted[0].score >= 60 ? '🏆' : '✖️';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 구구단 배틀 종료!</div>
        ${sorted.map((s, rank) => `
          <div style="font-family:var(--font-display);font-size:${rank===0?'var(--text-xl)':'var(--text-md)'};color:${rank===0?'#fdd835':'#aaa'};">
            ${['🥇','🥈','🥉','4️⃣'][rank]} ${LABELS[s.playerIndex]}: ${s.score}점
          </div>
        `).join('')}
      `;
      container.appendChild(overlay);
      if (typeof onGameOver === 'function') onGameOver(scoreList);
    }

    function destroy() {
      isGameOver = true;
      clearInterval(gameTimerH);
      clearInterval(qTimerH);
      if (container) container.innerHTML = '';
    }

    nextQuestion();
    startTimers();
    return { destroy };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['times-quiz'] = { init };

})();
