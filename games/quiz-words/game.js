'use strict';
/**
 * games/quiz-words/game.js
 * "영어 단어 퀴즈" — English Word Quiz (선착순 버저 방식)
 *
 * A Korean word is shown at the top for all players.
 * Each player has 4 choice buttons (A/B/C/D) with English words.
 * First player to tap the correct answer gets +15 pts.
 * Wrong answer = 2s lock for that player.
 * No answer in 10s = show answer, next question.
 */

(function registerQuizWords() {

  const WORDS = [
    { kr: '사과',     en: 'apple' },    { kr: '바나나',   en: 'banana' },
    { kr: '포도',     en: 'grape' },    { kr: '딸기',     en: 'strawberry' },
    { kr: '수박',     en: 'watermelon'},{ kr: '오렌지',   en: 'orange' },
    { kr: '복숭아',   en: 'peach' },    { kr: '레몬',     en: 'lemon' },
    { kr: '고양이',   en: 'cat' },      { kr: '강아지',   en: 'dog' },
    { kr: '토끼',     en: 'rabbit' },   { kr: '코끼리',   en: 'elephant' },
    { kr: '호랑이',   en: 'tiger' },    { kr: '사자',     en: 'lion' },
    { kr: '물고기',   en: 'fish' },     { kr: '새',       en: 'bird' },
    { kr: '나비',     en: 'butterfly' },{ kr: '개구리',   en: 'frog' },
    { kr: '학교',     en: 'school' },   { kr: '선생님',   en: 'teacher' },
    { kr: '친구',     en: 'friend' },   { kr: '책',       en: 'book' },
    { kr: '연필',     en: 'pencil' },   { kr: '가방',     en: 'bag' },
    { kr: '빨간색',   en: 'red' },      { kr: '파란색',   en: 'blue' },
    { kr: '노란색',   en: 'yellow' },   { kr: '초록색',   en: 'green' },
    { kr: '흰색',     en: 'white' },    { kr: '검은색',   en: 'black' },
    { kr: '하늘',     en: 'sky' },      { kr: '구름',     en: 'cloud' },
    { kr: '비',       en: 'rain' },     { kr: '눈',       en: 'snow' },
    { kr: '바람',     en: 'wind' },     { kr: '태양',     en: 'sun' },
    { kr: '달',       en: 'moon' },     { kr: '별',       en: 'star' },
    { kr: '물',       en: 'water' },    { kr: '불',       en: 'fire' },
    { kr: '집',       en: 'house' },    { kr: '문',       en: 'door' },
    { kr: '창문',     en: 'window' },   { kr: '의자',     en: 'chair' },
    { kr: '테이블',   en: 'table' },    { kr: '침대',     en: 'bed' },
    { kr: '빵',       en: 'bread' },    { kr: '우유',     en: 'milk' },
    { kr: '달걀',     en: 'egg' },      { kr: '치즈',     en: 'cheese' },
    { kr: '피자',     en: 'pizza' },    { kr: '케이크',   en: 'cake' },
    { kr: '발',       en: 'foot' },     { kr: '손',       en: 'hand' },
    { kr: '눈',       en: 'eye' },      { kr: '코',       en: 'nose' },
    { kr: '입',       en: 'mouth' },    { kr: '귀',       en: 'ear' },
    { kr: '머리',     en: 'head' },     { kr: '몸',       en: 'body' },
    { kr: '빠르다',   en: 'fast' },     { kr: '느리다',   en: 'slow' },
    { kr: '크다',     en: 'big' },      { kr: '작다',     en: 'small' },
    { kr: '뜨겁다',   en: 'hot' },      { kr: '차갑다',   en: 'cold' },
    { kr: '행복하다', en: 'happy' },    { kr: '슬프다',   en: 'sad' },
    { kr: '뛰다',     en: 'run' },      { kr: '수영하다', en: 'swim' },
    { kr: '날다',     en: 'fly' },      { kr: '먹다',     en: 'eat' },
    { kr: '마시다',   en: 'drink' },    { kr: '자다',     en: 'sleep' },
  ];

  function init(container, options) {
    const { playerCount = 2, playerColors = [], onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    const LABELS      = ['P1','P2','P3','P4'];
    const POINTS_WIN  = 15;
    const Q_TIMEOUT   = 10;

    let scores    = new Array(playerCount).fill(0);
    let locked    = new Array(playerCount).fill(false);
    let timeLeft  = gameDuration;
    let qTimer    = Q_TIMEOUT;
    let isGameOver   = false;
    let gameTimerH   = null, qTimerH = null;
    let currentQ     = null;
    let answerRevealed = false;
    let questionNum  = 0;

    const pool = [...WORDS].sort(() => Math.random() - 0.5);
    let poolIdx = 0;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: #0d1a1a;
      font-family: var(--font-body);
    `;

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
      <span id="qw-qnum" style="color:#aaa;font-size:var(--text-sm);">문제 1</span>
      <span id="qw-qtimer" style="font-family:var(--font-display);font-size:var(--text-xl);color:#80cbc4;">${Q_TIMEOUT}</span>
      <span id="qw-timer" style="color:#aaa;font-size:var(--text-sm);">⏱ ${gameDuration}s</span>
    `;
    container.appendChild(topBar);

    const qArea = document.createElement('div');
    qArea.style.cssText = `
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.5em;
      min-height: 0;
      gap: 0.4em;
    `;
    qArea.innerHTML = `
      <div style="font-family:var(--font-body);font-size:clamp(0.9rem,2.5vmin,1.3rem);color:#80cbc4;">영어로는?</div>
      <div id="qw-word" style="font-family:var(--font-display);font-size:clamp(2.5rem,10vmin,6rem);color:#fff;line-height:1;"></div>
      <div id="qw-answer-reveal" style="font-family:var(--font-display);font-size:clamp(1.2rem,3.5vmin,2rem);color:#80cbc4;min-height:1.5em;text-align:center;"></div>
    `;
    container.appendChild(qArea);

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

    const playerBtns = [];

    for (let p = 0; p < playerCount; p++) {
      const color = playerColors[p] || '#fff';
      const zone = document.createElement('div');
      zone.style.cssText = `flex:1;display:flex;flex-direction:column;gap:3px;overflow:hidden;`;

      const header = document.createElement('div');
      header.style.cssText = `
        text-align:center;font-family:var(--font-display);
        font-size:clamp(0.8rem,2.5vmin,1.3rem);padding:0.2em;
        background:rgba(255,255,255,0.08);border-radius:4px;flex-shrink:0;
      `;
      header.innerHTML = `<span style="color:${color};">${LABELS[p]}</span> <span id="qw-score-${p}" style="color:#fff;">0점</span>`;
      zone.appendChild(header);

      const grid = document.createElement('div');
      grid.style.cssText = `display:grid;grid-template-columns:1fr 1fr;gap:3px;flex:1;min-height:0;`;

      const pBtns = [];
      ['A','B','C','D'].forEach((label, ci) => {
        const btn = document.createElement('button');
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

    /* ── Refs ── */
    const wordEl     = container.querySelector('#qw-word');
    const qtimerEl   = container.querySelector('#qw-qtimer');
    const gameTimerEl= container.querySelector('#qw-timer');
    const revealEl   = container.querySelector('#qw-answer-reveal');
    const qnumEl     = container.querySelector('#qw-qnum');

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
        const el = container.querySelector(`#qw-score-${p}`);
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
        btn.style.background    = 'rgba(255,255,255,0.08)';
        btn.style.borderColor   = 'rgba(255,255,255,0.2)';
        btn.style.opacity       = '1';
        btn.style.pointerEvents = '';
        btn.style.transform     = '';
      }));

      if (poolIdx >= pool.length) {
        pool.sort(() => Math.random() - 0.5);
        poolIdx = 0;
      }
      currentQ = pool[poolIdx++];
      questionNum++;

      const wrongPool = WORDS.filter(w => w.en !== currentQ.en);
      const wrongs    = shuffle(wrongPool).slice(0, 3).map(w => w.en);
      const choices   = shuffle([currentQ.en, ...wrongs]);
      currentQ.choices    = choices;
      currentQ.correctIdx = choices.indexOf(currentQ.en);

      wordEl.textContent  = currentQ.kr;
      qnumEl.textContent  = `문제 ${questionNum}`;

      playerBtns.forEach(pBtns => {
        pBtns.forEach((btn, ci) => {
          btn.querySelector('.choice-text').textContent = choices[ci];
        });
      });

      qTimer = Q_TIMEOUT;
      qtimerEl.textContent = qTimer;
      qtimerEl.style.color = '#80cbc4';

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
      revealEl.textContent = `정답: ${currentQ.en}`;
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
        revealEl.style.color  = '#66bb6a';
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
      const winner    = sorted[0];
      const trophy    = winner.score >= 60 ? '🏆' : '🔤';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 퀴즈 종료!</div>
        ${sorted.map((s, rank) => `
          <div style="font-family:var(--font-display);font-size:${rank===0?'var(--text-xl)':'var(--text-md)'};color:${rank===0?'#80cbc4':'#aaa'};">
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
  window.GameModules['quiz-words'] = { init };

})();
