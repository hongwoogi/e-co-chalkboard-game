'use strict';
/**
 * games/quiz-flags/game.js
 * "국기 퀴즈" — Flag Quiz (선착순 버저 방식)
 *
 * A flag is shown at the top for all players.
 * Each player has 4 choice buttons (A/B/C/D).
 * First player to tap the correct answer gets +15 pts.
 * Wrong answer = 2s lock for that player.
 * No answer in 10s = show answer, next question.
 */

(function registerQuizFlags() {

  const FLAGS = [
    { code: 'kr', name: '대한민국' }, { code: 'jp', name: '일본' },
    { code: 'cn', name: '중국' },     { code: 'us', name: '미국' },
    { code: 'gb', name: '영국' },     { code: 'fr', name: '프랑스' },
    { code: 'de', name: '독일' },     { code: 'it', name: '이탈리아' },
    { code: 'es', name: '스페인' },   { code: 'br', name: '브라질' },
    { code: 'au', name: '호주' },     { code: 'ca', name: '캐나다' },
    { code: 'mx', name: '멕시코' },   { code: 'ru', name: '러시아' },
    { code: 'in', name: '인도' },     { code: 'za', name: '남아프리카' },
    { code: 'eg', name: '이집트' },   { code: 'sa', name: '사우디아라비아' },
    { code: 'th', name: '태국' },     { code: 'vn', name: '베트남' },
    { code: 'id', name: '인도네시아' },{ code: 'ph', name: '필리핀' },
    { code: 'my', name: '말레이시아' },{ code: 'sg', name: '싱가포르' },
    { code: 'tr', name: '튀르키예' }, { code: 'ar', name: '아르헨티나' },
    { code: 'nz', name: '뉴질랜드' }, { code: 'nl', name: '네덜란드' },
    { code: 'be', name: '벨기에' },   { code: 'pt', name: '포르투갈' },
    { code: 'se', name: '스웨덴' },   { code: 'no', name: '노르웨이' },
    { code: 'dk', name: '덴마크' },   { code: 'fi', name: '핀란드' },
    { code: 'ch', name: '스위스' },   { code: 'at', name: '오스트리아' },
    { code: 'gr', name: '그리스' },   { code: 'pl', name: '폴란드' },
    { code: 'ua', name: '우크라이나' },{ code: 'co', name: '콜롬비아' },
    { code: 'cl', name: '칠레' },     { code: 'pe', name: '페루' },
    { code: 'ke', name: '케냐' },     { code: 'ng', name: '나이지리아' },
    { code: 'il', name: '이스라엘' }, { code: 'ir', name: '이란' },
    { code: 'pk', name: '파키스탄' }, { code: 'bd', name: '방글라데시' },
  ];

  function init(container, options) {
    const { playerCount = 2, playerColors = [], onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    const LABELS      = ['P1','P2','P3','P4'];
    const POINTS_WIN  = 15;
    const Q_TIMEOUT   = 10; // seconds per question

    let scores    = new Array(playerCount).fill(0);
    let locked    = new Array(playerCount).fill(false); // per-player lock
    let timeLeft  = gameDuration;
    let qTimer    = Q_TIMEOUT;
    let isGameOver   = false;
    let gameTimerH   = null, qTimerH = null;
    let currentQ     = null;
    let answerRevealed = false;
    let questionNum  = 0;

    // Shuffle question pool
    const pool = [...FLAGS].sort(() => Math.random() - 0.5);
    let poolIdx = 0;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: #1a1a2e;
      font-family: var(--font-body);
    `;

    // Top bar
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.3em 0.8em;
      background: rgba(0,0,0,0.3);
      flex-shrink: 0;
    `;
    topBar.innerHTML = `
      <span id="qf-qnum" style="color:#aaa;font-size:var(--text-sm);">문제 1</span>
      <span id="qf-qtimer" style="font-family:var(--font-display);font-size:var(--text-xl);color:#fdd835;">${Q_TIMEOUT}</span>
      <span id="qf-timer" style="color:#aaa;font-size:var(--text-sm);">⏱ ${gameDuration}s</span>
    `;
    container.appendChild(topBar);

    // Question area
    const qArea = document.createElement('div');
    qArea.style.cssText = `
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.4em;
      min-height: 0;
      gap: 0.2em;
    `;
    qArea.innerHTML = `
      <div id="qf-flag" style="line-height:1;display:flex;align-items:center;justify-content:center;"></div>
      <div id="qf-qtext" style="font-family:var(--font-display);font-size:clamp(1rem,3vmin,1.8rem);color:#fff;text-align:center;"></div>
      <div id="qf-answer-reveal" style="font-family:var(--font-display);font-size:clamp(1.2rem,3.5vmin,2rem);color:#fdd835;min-height:1.5em;text-align:center;"></div>
    `;
    container.appendChild(qArea);

    // Player zones
    const zonesRow = document.createElement('div');
    zonesRow.style.cssText = `
      display: flex;
      flex: 1;
      min-height: 0;
      gap: 3px;
      padding: 3px;
      background: rgba(0,0,0,0.4);
    `;
    container.appendChild(zonesRow);

    const playerBtns = []; // [playerIdx][choiceIdx] = btn element

    for (let p = 0; p < playerCount; p++) {
      const color = playerColors[p] || '#fff';
      const zone = document.createElement('div');
      zone.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow: hidden;
      `;

      // Player header
      const header = document.createElement('div');
      header.style.cssText = `
        text-align: center;
        font-family: var(--font-display);
        font-size: clamp(0.8rem,2.5vmin,1.3rem);
        padding: 0.2em;
        background: rgba(255,255,255,0.08);
        border-radius: 4px;
        flex-shrink: 0;
      `;
      header.innerHTML = `<span style="color:${color};">${LABELS[p]}</span> <span id="qf-score-${p}" style="color:#fff;">0점</span>`;
      zone.appendChild(header);

      // 2×2 answer grid
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3px;
        flex: 1;
        min-height: 0;
      `;

      const pBtns = [];
      ['A','B','C','D'].forEach((label, ci) => {
        const btn = document.createElement('button');
        btn.dataset.choice = ci;
        btn.style.cssText = `
          border: 2.5px solid rgba(255,255,255,0.25);
          border-radius: 1.2em;
          background: rgba(255,255,255,0.1);
          color: #fff;
          font-family: var(--font-display);
          font-size: clamp(1.1rem,3vmin,1.9rem);
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
        btn.innerHTML = `<span style="opacity:0.5;font-size:0.8em;">${label}</span><span class="choice-text" style="font-size:1em;"></span>`;

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

    /* ── Helpers ── */
    const flagEl    = container.querySelector('#qf-flag');
    const qtextEl   = container.querySelector('#qf-qtext');
    const qtimerEl  = container.querySelector('#qf-qtimer');
    const gameTimerEl = container.querySelector('#qf-timer');
    const revealEl  = container.querySelector('#qf-answer-reveal');
    const qnumEl    = container.querySelector('#qf-qnum');

    function shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function flagEmoji(code) {
      return code.toUpperCase().split('').map(c =>
        String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
      ).join('');
    }

    function updateScores() {
      for (let p = 0; p < playerCount; p++) {
        const el = container.querySelector(`#qf-score-${p}`);
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

    /* ── Question ── */
    function nextQuestion() {
      if (isGameOver) return;
      answerRevealed = false;
      locked.fill(false);
      revealEl.textContent = '';

      // Reset button styles
      playerBtns.forEach(pBtns => pBtns.forEach(btn => {
        btn.style.background    = 'rgba(255,255,255,0.08)';
        btn.style.borderColor   = 'rgba(255,255,255,0.2)';
        btn.style.opacity       = '1';
        btn.style.pointerEvents = '';
        btn.style.transform     = '';
      }));

      if (poolIdx >= pool.length) {
        // Restart pool shuffled
        pool.sort(() => Math.random() - 0.5);
        poolIdx = 0;
      }
      currentQ = pool[poolIdx++];
      questionNum++;

      // Pick 3 wrong answers
      const wrongPool = FLAGS.filter(f => f.name !== currentQ.name);
      const wrongs    = shuffle(wrongPool).slice(0, 3).map(f => f.name);
      const choices   = shuffle([currentQ.name, ...wrongs]);
      currentQ.choices   = choices;
      currentQ.correctIdx = choices.indexOf(currentQ.name);

      flagEl.innerHTML     = `<span style="font-size:clamp(5rem,18vmin,12rem);line-height:1;">${flagEmoji(currentQ.code)}</span>`;
      qtextEl.textContent  = '이 나라의 이름은?';
      qnumEl.textContent   = `문제 ${questionNum}`;

      // Update all player buttons
      playerBtns.forEach(pBtns => {
        pBtns.forEach((btn, ci) => {
          btn.querySelector('.choice-text').textContent = choices[ci];
        });
      });

      // Q timer
      qTimer = Q_TIMEOUT;
      qtimerEl.textContent = qTimer;
      qtimerEl.style.color = '#fdd835';

      clearInterval(qTimerH);
      qTimerH = setInterval(() => {
        qTimer--;
        qtimerEl.textContent = qTimer;
        if (qTimer <= 3) qtimerEl.style.color = '#ff5252';
        if (qTimer <= 0) {
          clearInterval(qTimerH);
          timeoutQuestion();
        }
      }, 1000);
    }

    function timeoutQuestion() {
      if (isGameOver) return;
      answerRevealed = true;
      revealEl.textContent = `정답: ${currentQ.name}`;
      setAllBtnsEnabled(false);
      // Highlight correct on all player grids
      playerBtns.forEach(pBtns => {
        pBtns[currentQ.correctIdx].style.background   = 'rgba(100,200,100,0.4)';
        pBtns[currentQ.correctIdx].style.borderColor  = '#66bb6a';
      });
      setTimeout(nextQuestion, 2200);
    }

    function handleAnswer(playerIdx, choiceIdx) {
      clearInterval(qTimerH);
      answerRevealed = true;

      const correct = choiceIdx === currentQ.correctIdx;
      const btn     = playerBtns[playerIdx][choiceIdx];

      if (correct) {
        window.SoundEngine?.play("correct");
        scores[playerIdx] += POINTS_WIN;
        btn.style.background  = 'rgba(100,220,100,0.5)';
        btn.style.borderColor = '#66bb6a';
        btn.style.transform   = 'scale(1.05)';
        revealEl.textContent  = `✅ ${['P1','P2','P3','P4'][playerIdx]} 정답! +${POINTS_WIN}점`;
        revealEl.style.color  = '#66bb6a';
        updateScores();
        // Lock everyone, show answer, next question
        setAllBtnsEnabled(false);
        // Highlight correct on other players' grids too
        playerBtns.forEach((pBtns, p) => {
          if (p !== playerIdx) {
            pBtns[currentQ.correctIdx].style.background  = 'rgba(100,200,100,0.2)';
            pBtns[currentQ.correctIdx].style.borderColor = '#66bb6a';
          }
        });
        setTimeout(nextQuestion, 1800);
      } else {
        // Wrong — lock just this player for 2s
        btn.style.background  = 'rgba(220,80,80,0.4)';
        btn.style.borderColor = '#ef5350';
        window.SoundEngine?.play("wrong");
        locked[playerIdx] = true;
        playerBtns[playerIdx].forEach(b => {
          b.style.opacity = '0.4';
          b.style.pointerEvents = 'none';
        });
        answerRevealed = false; // others can still answer
        setTimeout(() => {
          if (isGameOver) return;
          locked[playerIdx] = false;
          playerBtns[playerIdx].forEach(b => {
            b.style.opacity = '';
            b.style.pointerEvents = '';
          });
          btn.style.background  = 'rgba(255,255,255,0.08)';
          btn.style.borderColor = 'rgba(255,255,255,0.2)';
        }, 2000);
        // Resume q timer
        qTimerH = setInterval(() => {
          qTimer--;
          qtimerEl.textContent = qTimer;
          if (qTimer <= 3) qtimerEl.style.color = '#ff5252';
          if (qTimer <= 0) { clearInterval(qTimerH); timeoutQuestion(); }
        }, 1000);
      }
    }

    /* ── Timers ── */
    function startTimers() {
      gameTimerH = setInterval(() => {
        if (isGameOver) return;
        timeLeft--;
        gameTimerEl.textContent = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    /* ── End ── */
    function endGame() {
      isGameOver = true;
      clearInterval(gameTimerH);
      clearInterval(qTimerH);

      const scoreList = scores.map((s, i) => ({ playerIndex: i, score: s }));
      const sorted    = [...scoreList].sort((a, b) => b.score - a.score);
      const winner    = sorted[0];
      const trophy    = winner.score >= 60 ? '🏆' : '🌍';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 퀴즈 종료!</div>
        ${sorted.map((s, rank) => `
          <div style="font-family:var(--font-display);font-size:${rank===0?'var(--text-xl)':'var(--text-md)'};color:${rank===0?'#fdd835':'#aaa'};">
            ${['🥇','🥈','🥉','4️⃣'][rank]} ${['P1','P2','P3','P4'][s.playerIndex]}: ${s.score}점
          </div>
        `).join('')}
      `;
      container.appendChild(overlay);
      if (typeof onGameOver === 'function') onGameOver(scoreList);
    }

    /* ── Destroy ── */
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
  window.GameModules['quiz-flags'] = { init };

})();
