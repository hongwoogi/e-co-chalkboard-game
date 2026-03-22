/**
 * tetris/game.js
 * Classic Tetris for the chalkboard game platform.
 */
'use strict';

(function () {
  const COLS = 10, ROWS = 20;
  const COLORS = ['#00bcd4','#fdd835','#ab47bc','#66bb6a','#ef5350','#1e88e5','#ff7043'];

  // [rotations][cells as [row,col]]
  const PIECES = [
    [[0,0],[0,1],[0,2],[0,3]],  // I
    [[0,0],[0,1],[1,0],[1,1]],  // O
    [[0,1],[1,0],[1,1],[1,2]],  // T
    [[0,1],[0,2],[1,0],[1,1]],  // S
    [[0,0],[0,1],[1,1],[1,2]],  // Z
    [[0,0],[1,0],[1,1],[1,2]],  // J
    [[0,2],[1,0],[1,1],[1,2]],  // L
  ];

  function rotatePiece(cells) {
    const maxR = Math.max(...cells.map(c => c[0]));
    return cells.map(([r, c]) => [c, maxR - r]);
  }

  function init(container, options) {
    const { playerIndex = 0, playerColor = '#00bcd4', onGameOver } = options || {};
    const gameDuration = (window._gameSettings && window._gameSettings.duration) || 60;

    let board, piece, pieceColor, piecePos, score, lines, level, dropInterval, gameOver, timeLeft, timerHandle, dropHandle;

    /* ── Build UI ── */
    container.innerHTML = '';
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:#1a1a2e;overflow:hidden;position:relative;';

    // HUD
    const hud = document.createElement('div');
    hud.style.cssText = 'width:100%;display:flex;justify-content:space-between;align-items:center;padding:0.3em 0.6em;box-sizing:border-box;flex-shrink:0;';
    hud.innerHTML = `
      <span id="t-score-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-lg);color:${playerColor};">0</span>
      <span id="t-timer-${playerIndex}" style="font-family:var(--font-display);font-size:var(--text-md);color:#fff;"></span>
      <span id="t-lines-${playerIndex}" style="font-family:var(--font-body);font-size:var(--text-sm);color:#aaa;">0줄</span>
    `;
    container.appendChild(hud);

    // Canvas wrapper
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;min-height:0;width:100%;';
    container.appendChild(wrap);

    // Control buttons (added after canvas is appended)
    const controls = document.createElement('div');
    controls.style.cssText = 'width:100%;display:flex;justify-content:center;align-items:center;gap:0.4em;padding:0.3em 0.5em;box-sizing:border-box;flex-shrink:0;background:rgba(0,0,0,0.3);';

    function makeBtn(label, onPress) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        flex: 1;
        max-width: 4em;
        aspect-ratio: 1;
        border: none;
        border-radius: 0.5em;
        background: rgba(255,255,255,0.12);
        color: #fff;
        font-size: clamp(1.2rem, 3.5vw, 2rem);
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.1s, transform 0.1s;
      `;
      const onDown = (e) => {
        e.preventDefault();
        if (gameOver) return;
        onPress();
        draw();
        btn.style.background = 'rgba(255,255,255,0.28)';
        btn.style.transform  = 'scale(0.92)';
      };
      const onUp = (e) => {
        e.preventDefault();
        btn.style.background = '';
        btn.style.transform  = '';
      };
      btn.addEventListener('touchstart', onDown, { passive: false });
      btn.addEventListener('touchend',   onUp,   { passive: false });
      btn.addEventListener('mousedown',  onDown);
      btn.addEventListener('mouseup',    onUp);
      btn.addEventListener('mouseleave', onUp);
      return btn;
    }

    // Left
    controls.appendChild(makeBtn('◀', () => {
      const next = [piecePos[0], piecePos[1] - 1];
      if (canPlace(piece, next)) piecePos = next;
    }));
    // Rotate
    controls.appendChild(makeBtn('↻', () => {
      const rotated = rotatePiece(piece);
      if (canPlace(rotated, piecePos)) piece = rotated;
      else if (canPlace(rotated, [piecePos[0], piecePos[1]-1])) { piece = rotated; piecePos[1]--; }
      else if (canPlace(rotated, [piecePos[0], piecePos[1]+1])) { piece = rotated; piecePos[1]++; }
    }));
    // Hard drop
    controls.appendChild(makeBtn('▼', () => {
      while (canPlace(piece, [piecePos[0]+1, piecePos[1]])) piecePos[0]++;
      lockPiece();
    }));
    // Right
    controls.appendChild(makeBtn('▶', () => {
      const next = [piecePos[0], piecePos[1] + 1];
      if (canPlace(piece, next)) piecePos = next;
    }));

    container.appendChild(controls);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;';
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let cellSize = 20;

    function resize() {
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      cellSize = Math.max(8, Math.min(Math.floor(W / COLS), Math.floor(H / ROWS)));
      canvas.width  = cellSize * COLS;
      canvas.height = cellSize * ROWS;
      draw();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function newBoard() {
      return Array.from({length: ROWS}, () => new Array(COLS).fill(null));
    }

    function newPiece() {
      const idx = Math.floor(Math.random() * PIECES.length);
      piece = PIECES[idx].map(c => [...c]);
      pieceColor = COLORS[idx];
      piecePos = [0, Math.floor((COLS - 4) / 2)];
      if (!canPlace(piece, piecePos)) endGame();
    }

    function canPlace(cells, [pr, pc]) {
      return cells.every(([r, c]) => {
        const nr = pr + r, nc = pc + c;
        return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !board[nr][nc];
      });
    }

    function lockPiece() {
      piece.forEach(([r, c]) => {
        const nr = piecePos[0] + r, nc = piecePos[1] + c;
        if (nr >= 0) board[nr][nc] = pieceColor;
      });
      clearLines();
      newPiece();
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(c => c)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(null));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        const pts = [0,100,300,500,800][cleared] * (level + 1);
        score += pts;
        level = Math.floor(lines / 10);
        updateHUD();
        window.SoundEngine?.play(cleared >= 2 ? 'combo' : 'line');
      }
    }

    function drop() {
      const next = [piecePos[0] + 1, piecePos[1]];
      if (canPlace(piece, next)) {
        piecePos = next;
      } else {
        lockPiece();
      }
      draw();
    }

    function draw() {
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*cellSize,0); ctx.lineTo(c*cellSize,canvas.height); ctx.stroke(); }
      for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*cellSize); ctx.lineTo(canvas.width,r*cellSize); ctx.stroke(); }

      // Ghost piece
      let ghostPos = [...piecePos];
      while (canPlace(piece, [ghostPos[0]+1, ghostPos[1]])) ghostPos[0]++;
      piece.forEach(([r,c]) => {
        const nr = ghostPos[0]+r, nc = ghostPos[1]+c;
        if (nr>=0) drawCell(nc, nr, pieceColor, 0.22);
      });

      // Board
      board.forEach((row, r) => row.forEach((col, c) => { if (col) drawCell(c, r, col, 1); }));

      // Active piece
      piece.forEach(([r,c]) => {
        const nr = piecePos[0]+r, nc = piecePos[1]+c;
        if (nr>=0) drawCell(nc, nr, pieceColor, 1);
      });
    }

    function drawCell(x, y, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x*cellSize+1, y*cellSize+1, cellSize-2, cellSize-2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x*cellSize+1, y*cellSize+1, cellSize-2, 3);
      ctx.globalAlpha = 1;
    }

    function updateHUD() {
      const el = document.getElementById(`t-score-${playerIndex}`);
      const le = document.getElementById(`t-lines-${playerIndex}`);
      if (el) el.textContent = score;
      if (le) le.textContent = `${lines}줄`;
    }

    function updateTimer() {
      const el = document.getElementById(`t-timer-${playerIndex}`);
      if (el) { el.textContent = `${timeLeft}s`; el.style.color = timeLeft <= 10 ? '#ff5252' : '#fff'; }
    }

    function endGame() {
      gameOver = true;
      clearInterval(dropHandle);
      clearInterval(timerHandle);

      const best = parseInt(localStorage.getItem(`tetris_best_${playerIndex}`) || '0');
      if (score > best) localStorage.setItem(`tetris_best_${playerIndex}`, score);
      const isNewBest = score > best;
      const trophy = score >= 500 ? '🏆' : score >= 200 ? '🥈' : '🎯';

      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${trophy} 게임 종료!</div>
        <div class="game-over-score">${score}<span style="font-size:0.5em;color:var(--on-surface-variant)">점</span></div>
        <div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${lines}줄 제거</div>
        ${isNewBest ? `<div style="font-family:var(--font-body);font-size:var(--text-md);color:var(--primary);animation:bounceIn 0.5s 0.3s both;">🌟 최고 기록!</div>`
                    : `<div style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">최고: ${Math.max(score,best)}점</div>`}
      `;
      container.appendChild(overlay);
      if (typeof onGameOver === 'function') onGameOver(score);
    }

    /* ── Touch controls ── */
    let touchStartX, touchStartY, touchStartTime;

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (gameOver) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dt = Date.now() - touchStartTime;
      const absDx = Math.abs(dx), absDy = Math.abs(dy);

      if (dt < 200 && absDx < 15 && absDy < 15) {
        // Tap → rotate
        const rotated = rotatePiece(piece);
        if (canPlace(rotated, piecePos)) piece = rotated;
        else if (canPlace(rotated, [piecePos[0], piecePos[1]-1])) { piece = rotated; piecePos[1]--; }
        else if (canPlace(rotated, [piecePos[0], piecePos[1]+1])) { piece = rotated; piecePos[1]++; }
      } else if (absDx > absDy) {
        // Horizontal swipe → move
        const dir = dx > 0 ? 1 : -1;
        const steps = Math.max(1, Math.round(absDx / cellSize));
        for (let i = 0; i < steps; i++) {
          const next = [piecePos[0], piecePos[1] + dir];
          if (canPlace(piece, next)) piecePos = next; else break;
        }
      } else if (dy > 30) {
        // Swipe down → hard drop
        while (canPlace(piece, [piecePos[0]+1, piecePos[1]])) piecePos[0]++;
        lockPiece();
      }
      draw();
    }, { passive: false });

    /* ── Start game ── */
    function startGame() {
      board = newBoard();
      score = 0; lines = 0; level = 0; gameOver = false; timeLeft = gameDuration;
      updateHUD(); updateTimer();
      newPiece();
      resize();

      const baseInterval = 800;
      dropHandle = setInterval(() => {
        if (!gameOver) {
          drop();
          // Increase speed with level
          clearInterval(dropHandle);
          dropHandle = setInterval(() => { if (!gameOver) drop(); }, Math.max(100, baseInterval - level * 60));
        }
      }, baseInterval);

      timerHandle = setInterval(() => {
        timeLeft--;
        updateTimer();
        if (timeLeft <= 0) endGame();
      }, 1000);
    }

    startGame();

    return {
      destroy() {
        clearInterval(dropHandle);
        clearInterval(timerHandle);
        ro.disconnect();
      }
    };
  }

  window.GameModules = window.GameModules || {};
  window.GameModules['tetris'] = { init };
})();
