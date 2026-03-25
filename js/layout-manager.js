/**
 * layout-manager.js
 * Builds and manages the split-screen panel layout.
 *
 * Responsibilities:
 *  - Create N player-panel divs inside #game-container
 *  - Apply the correct layout data-attribute
 *  - Assign player colours and badges
 *  - Render the game-select UI inside each panel
 *  - Load and tear down game instances per panel
 *  - Expose a clean public API used by app.js
 */

'use strict';

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */

/** One accent colour per player slot (up to 4) */
const PLAYER_COLORS = [
  'var(--color-player-1)',   // player 1 — blue
  'var(--color-player-2)',   // player 2 — coral
  'var(--color-player-3)',   // player 3 — gold
  'var(--color-player-4)',   // player 4 — purple
];

/** Human-readable labels */
const PLAYER_LABELS = ['P1', 'P2', 'P3', 'P4'];

/* ─────────────────────────────────────────────
   MODULE STATE
   ───────────────────────────────────────────── */
const LayoutManager = (() => {

  /** Currently active game instances, keyed by panel index */
  const _gameInstances = {};

  /** Track game-over reports per session */
  let _endedScores = [];
  let _expectedPanels = 0;

  /** Pending game-over overlay timeout — cancelled on destroy */
  let _gameOverTimeout = null;

  /** Session token — incremented on every destroy() so stale callbacks are ignored */
  let _sessionToken = 0;

  /** Currently active panels (DOM element references) */
  let _panels = [];

  /** The current layout descriptor string */
  let _currentLayout = null;

  /** Timer state */
  let _timerInterval = null;
  let _timerStartedAt = 0;
  let _timerDuration  = 0;

  /** Pending init callbacks per gameId while script is loading */
  const _pendingCallbacks = {};

  /* ── Helpers ──────────────────────────────── */

  /**
   * Maps player count + layout variant to the data-layout attribute value.
   * @param {number} playerCount
   * @param {'strips'|'grid'} [variant] — only relevant for 4 players
   * @returns {string}
   */
  function _layoutKey(playerCount, variant) {
    if (playerCount === 4) {
      return variant === 'grid' ? '4-grid' : '4-strips';
    }
    return String(playerCount);
  }

  /**
   * Resolve a CSS custom property to its computed value on :root.
   * Used so we can read actual hex values for colours when needed.
   * @param {string} varName  e.g. '--color-player-1'
   * @returns {string}
   */
  function _resolveCSSVar(varName) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  }

  /* ── Panel building ───────────────────────── */

  /**
   * Build and return one player-panel element.
   * @param {number} index  0-based player index
   * @returns {HTMLElement}
   */
  function _buildPanel(index) {
    const colorVar = PLAYER_COLORS[index];
    const label    = PLAYER_LABELS[index];

    const panel = document.createElement('div');
    panel.className   = 'player-panel chalk-bg';
    panel.dataset.playerIndex = index;

    // Inject the player colour as a local custom property so all
    // child components can reference --panel-color without knowing the player index.
    panel.style.setProperty('--panel-color', colorVar);

    // ── Panel header ──────────────────────────
    const header = document.createElement('div');
    header.className = 'panel-header';

    // Player badge
    const badge = document.createElement('div');
    badge.className   = 'panel-player-badge';
    badge.textContent = label;

    // Game name label
    const nameEl = document.createElement('span');
    nameEl.className = 'panel-game-name';
    nameEl.textContent = '게임 선택 중…';
    nameEl.dataset.role = 'game-name';

    header.appendChild(badge);
    header.appendChild(nameEl);

    // ── Timer bar ─────────────────────────────
    const timerBar = document.createElement('div');
    timerBar.className = 'panel-timer-bar';
    const timerFill = document.createElement('div');
    timerFill.className = 'panel-timer-fill';
    timerFill.dataset.role = 'timer-fill';
    timerBar.appendChild(timerFill);

    // ── Panel content ─────────────────────────
    const content = document.createElement('div');
    content.className = 'panel-content';
    content.dataset.role = 'content';

    panel.appendChild(header);
    panel.appendChild(timerBar);
    panel.appendChild(content);

    return panel;
  }

  /* ── Game select UI ───────────────────────── */

  /**
   * Render the game selection grid inside a panel's content area.
   * @param {number} panelIndex
   */
  function _renderGameSelect(panelIndex) {
    const panel   = _panels[panelIndex];
    if (!panel) return;

    const content = panel.querySelector('[data-role="content"]');
    const nameEl  = panel.querySelector('[data-role="game-name"]');

    if (nameEl) nameEl.textContent = '게임을 선택하세요';

    // Build game select HTML
    content.innerHTML = '';

    // Header row
    const selectHeader = document.createElement('div');
    selectHeader.className = 'game-select-header';
    selectHeader.innerHTML = `<h2 class="game-select-title">🎮 게임 선택</h2>`;
    content.appendChild(selectHeader);

    // Card grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(45%, 8rem), 1fr));
      gap: var(--space-sm);
      padding: var(--space-sm);
      overflow-y: auto;
      flex: 1;
      align-content: start;
    `;

    window.GAMES.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card' + (game.available ? '' : ' locked');
      card.style.setProperty('--card-color', game.color);

      // Sticker badge
      let stickerHTML = '';
      if (game.isNew) {
        stickerHTML = `<span class="sticker sticker-new">NEW</span>`;
      } else if (game.isHot) {
        stickerHTML = `<span class="sticker sticker-hot">HOT 🔥</span>`;
      }

      card.innerHTML = `
        ${stickerHTML}
        <div class="game-card-icon">${game.icon}</div>
        <div class="game-card-name">${game.name}</div>
        <div class="game-card-desc">${game.available ? game.description : '🔒 준비 중'}</div>
      `;

      if (game.available) {
        // Touch + mouse handlers
        const _launch = (e) => {
          e.preventDefault();
          if (game.difficulties) {
            _showDifficultyPicker(panelIndex, game);
          } else {
            _loadGame(panelIndex, game.id);
          }
        };
        card.addEventListener('click', _launch);
        card.addEventListener('touchend', _launch, { passive: false });
      }

      grid.appendChild(card);
    });

    content.appendChild(grid);

    // Animate cards in with staggered delay
    requestAnimationFrame(() => {
      const cards = grid.querySelectorAll('.game-card');
      cards.forEach((c, i) => {
        c.style.opacity = '0';
        c.style.transform = 'translateY(20px) scale(0.9)';
        c.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
        c.style.transitionDelay = `${i * 55}ms`;
        requestAnimationFrame(() => {
          c.style.opacity = '';
          c.style.transform = '';
        });
      });
    });
  }

  /* ── Difficulty picker ────────────────────── */

  /**
   * Show an in-panel difficulty selection screen.
   * Stores the chosen difficulty globally so all panels use the same setting.
   * @param {number} panelIndex
   * @param {object} game  Game registry entry (must have game.difficulties)
   */
  function _showDifficultyPicker(panelIndex, game) {
    const panel = _panels[panelIndex];
    if (!panel) return;

    const content = panel.querySelector('[data-role="content"]');
    const nameEl  = panel.querySelector('[data-role="game-name"]');
    if (nameEl) nameEl.textContent = game.name;

    content.innerHTML = '';
    content.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:var(--space-sm);padding:var(--space-sm);box-sizing:border-box;';

    // Already stored? Show it is already chosen but let re-pick
    const stored = window._gameSettings && window._gameSettings.difficulties && window._gameSettings.difficulties[game.id];

    const title = document.createElement('div');
    title.style.cssText = 'font-family:var(--font-display);font-size:var(--text-xl);color:var(--panel-color);text-align:center;';
    title.textContent = `${game.icon} 난이도 선택`;
    content.appendChild(title);

    game.difficulties.forEach(diff => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        width: 85%;
        max-width: 280px;
        min-height: auto;
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-lg);
        border: 2px solid ${stored && stored.id === diff.id ? 'var(--panel-color)' : 'rgba(255,255,255,0.2)'};
        background: ${stored && stored.id === diff.id ? 'rgba(255,255,255,0.1)' : 'transparent'};
        color: var(--on-surface);
        font-family: var(--font-display);
        font-size: var(--text-md);
        cursor: pointer;
        touch-action: manipulation;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        transition: border-color 0.15s, background 0.15s;
      `;
      btn.innerHTML = `<span>${diff.label}</span><span style="font-family:var(--font-body);font-size:var(--text-sm);color:var(--on-surface-variant);">${diff.sub}</span>`;

      const pick = (e) => {
        e.preventDefault();
        window._gameSettings = window._gameSettings || {};
        window._gameSettings.difficulties = window._gameSettings.difficulties || {};
        window._gameSettings.difficulties[game.id] = diff;
        content.style.cssText = ''; // reset inline style
        _loadGame(panelIndex, game.id);
      };
      btn.addEventListener('click', pick);
      btn.addEventListener('touchend', pick, { passive: false });
      content.appendChild(btn);
    });

    // Back button
    const back = document.createElement('button');
    back.style.cssText = `
      margin-top: var(--space-xs);
      background: transparent;
      border: none;
      color: var(--on-surface-variant);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      cursor: pointer;
      touch-action: manipulation;
    `;
    back.textContent = '← 게임 선택으로';
    back.addEventListener('click', () => { content.style.cssText = ''; _renderGameSelect(panelIndex); });
    back.addEventListener('touchend', e => { e.preventDefault(); content.style.cssText = ''; _renderGameSelect(panelIndex); }, { passive: false });
    content.appendChild(back);
  }

  /* ── Game loading & teardown ──────────────── */

  /**
   * Load a game into a panel by its registry id.
   * Calls the game module's `init(container, options)` function.
   * @param {number} panelIndex
   * @param {string} gameId
   */
  function _loadGame(panelIndex, gameId) {
    const game  = window.getGameById(gameId);
    const panel = _panels[panelIndex];
    if (!game || !panel) return;

    // Tear down any existing game in this panel first
    _tearDownGame(panelIndex);

    const content = panel.querySelector('[data-role="content"]');
    const nameEl  = panel.querySelector('[data-role="game-name"]');

    // Clear content and show loading state
    content.innerHTML = `
      <div class="empty-state">
        <div class="spinner"></div>
        <div class="empty-state-text">로딩 중…</div>
      </div>
    `;

    if (nameEl) nameEl.textContent = game.name;

    // Run the game module's init for this panel
    const myToken = _sessionToken;
    const _doInit = () => {
      if (myToken !== _sessionToken) return; // session changed before script loaded
      const mod = window.GameModules && window.GameModules[gameId];
      if (!mod || typeof mod.init !== 'function') {
        content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">게임을 불러올 수 없어요</div></div>`;
        return;
      }
      content.innerHTML = '';
      const instance = mod.init(content, {
        playerIndex: panelIndex,
        playerColor: PLAYER_COLORS[panelIndex],
        onGameOver:  (score) => _handleGameOver(panelIndex, gameId, score, myToken),
      });
      _gameInstances[panelIndex] = instance;
    };

    // If module already registered, init immediately
    if (window.GameModules && window.GameModules[gameId]) {
      _doInit();
      return;
    }

    // If script is already loading (another panel requested it), queue this init
    const scriptId = `game-script-${gameId}`;
    if (_pendingCallbacks[gameId]) {
      _pendingCallbacks[gameId].push(_doInit);
      return;
    }

    // First request: inject script and set up callback queue
    _pendingCallbacks[gameId] = [_doInit];

    const script = document.createElement('script');
    script.id  = scriptId;
    script.src = `games/${game.entryFile}?v=${Date.now()}`;
    script.onload = () => {
      // Fire all queued inits now that the module is registered
      (_pendingCallbacks[gameId] || []).forEach(cb => cb());
      delete _pendingCallbacks[gameId];
    };
    script.onerror = () => {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">게임 파일을 찾을 수 없어요</div></div>`;
      delete _pendingCallbacks[gameId];
    };
    document.head.appendChild(script);
  }

  /**
   * Cleanly destroy a running game instance in a panel.
   * @param {number} panelIndex
   */
  function _tearDownGame(panelIndex) {
    const inst = _gameInstances[panelIndex];
    if (inst && typeof inst.destroy === 'function') {
      try { inst.destroy(); } catch(e) { /* ignore */ }
    }
    delete _gameInstances[panelIndex];
  }

  /**
   * Handle game-over event from a game module.
   * Shows the global game-over overlay once all panels have reported.
   * @param {number} panelIndex
   * @param {string} gameId
   * @param {number} score
   */
  function _handleGameOver(panelIndex, gameId, score, token) {
    if (token !== _sessionToken) return; // stale callback from a previous session
    console.log(`[LayoutManager] Panel ${panelIndex} game over — ${gameId} score: ${score}`);

    // Avoid double-counting if same panel fires twice
    if (_endedScores.some(s => s.playerIndex === panelIndex)) return;
    _endedScores.push({ playerIndex: panelIndex, score });

    if (_endedScores.length >= _expectedPanels) {
      const sorted = [..._endedScores].sort((a, b) => a.playerIndex - b.playerIndex);
      if (typeof window.showGameOverOverlay === 'function') {
        // Small delay so the in-game "time up" animation can finish
        clearTimeout(_gameOverTimeout);
        _gameOverTimeout = setTimeout(() => window.showGameOverOverlay(sorted), 600);
      }
    }
  }

  /**
   * Navigate a panel back to the game select screen.
   * @param {number} panelIndex
   */
  function _returnToGameSelect(panelIndex) {
    _tearDownGame(panelIndex);
    _renderGameSelect(panelIndex);
  }

  /* ── Timer ────────────────────────────────── */

  function _clearTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    /* Reset all fills to empty */
    _panels.forEach(p => {
      const f = p.querySelector('[data-role="timer-fill"]');
      if (f) { f.style.width = '0%'; f.style.background = '#4ade80'; }
    });
  }

  function startTimer(duration) {
    _clearTimer();
    if (!duration || duration <= 0) return;
    _timerDuration  = duration * 1000;
    _timerStartedAt = Date.now();

    function tick() {
      const ratio = Math.max(0, 1 - (Date.now() - _timerStartedAt) / _timerDuration);
      const color  = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fdd34d' : '#f87171';
      _panels.forEach(p => {
        const f = p.querySelector('[data-role="timer-fill"]');
        if (!f) return;
        f.style.width      = `${ratio * 100}%`;
        f.style.background = color;
      });
      if (ratio <= 0) _clearTimer();
    }

    /* Set fills to 100% immediately */
    _panels.forEach(p => {
      const f = p.querySelector('[data-role="timer-fill"]');
      if (f) { f.style.width = '100%'; f.style.background = '#4ade80'; }
    });
    _timerInterval = setInterval(tick, 250);
  }

  /* ── Public API ───────────────────────────── */

  /**
   * Build the game container with the specified number of players and layout.
   *
   * @param {number} playerCount  1–4
   * @param {'strips'|'grid'} [variant]  Only used when playerCount === 4.
   *        'strips' → 1×4 horizontal strips
   *        'grid'   → 2×2 grid
   */
  function build(playerCount, variant = 'strips') {
    // Clamp
    playerCount = Math.max(1, Math.min(4, playerCount));

    // Clean up existing panels
    destroy();

    const container = document.getElementById('game-container');
    if (!container) {
      console.error('[LayoutManager] #game-container not found');
      return;
    }

    _currentLayout = _layoutKey(playerCount, variant);
    container.dataset.layout = _currentLayout;
    container.classList.add('active');

    // Reset game-over tracking for this new session
    _endedScores = [];
    _expectedPanels = playerCount;

    // Clear old panels
    container.innerHTML = '';
    _panels = [];

    // Create panels
    for (let i = 0; i < playerCount; i++) {
      const panel = _buildPanel(i);
      container.appendChild(panel);
      _panels.push(panel);

      if (_currentLayout !== '4-grid') {
        // Animate panels in with staggered delay
        panel.style.opacity = '0';
        panel.style.transform = 'scale(0.92)';
        panel.style.transition = 'opacity 0.35s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        panel.style.transitionDelay = `${i * 80}ms`;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            panel.style.opacity = '';
            panel.style.transform = '';
          });
        });
      }
    }

    // For 4-grid: rotate left panels CW, right panels CCW — no scale (keeps ratio)
    if (_currentLayout === '4-grid') {
      requestAnimationFrame(() => {
        _panels.forEach((panel, i) => {
          const angle = (i === 0 || i === 2) ? 90 : -90;
          panel.style.opacity = '0';
          panel.style.transform = `rotate(${angle}deg)`;
          panel.style.transformOrigin = 'center';
          panel.style.transition = `opacity 0.4s ease ${i * 80}ms`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            panel.style.opacity = '1';
          }));
        });
      });
    }

    // Render game select in each panel
    _panels.forEach((_, i) => _renderGameSelect(i));
  }

  /**
   * Destroy all panels and clean up game instances.
   * Called before building a new layout.
   */
  function destroy() {
    _clearTimer();
    ++_sessionToken; // invalidate all pending callbacks from previous session
    clearTimeout(_gameOverTimeout);
    _gameOverTimeout = null;
    _panels.forEach((_, i) => _tearDownGame(i));
    _panels = [];
    _currentLayout = null;
    _endedScores = [];
    _expectedPanels = 0;

    const container = document.getElementById('game-container');
    if (container) {
      container.classList.remove('active');
      container.innerHTML = '';
      delete container.dataset.layout;
    }
  }

  /**
   * Programmatically load a game into a specific panel from outside this module.
   * @param {number} panelIndex
   * @param {string} gameId
   */
  function loadGameInPanel(panelIndex, gameId) {
    _loadGame(panelIndex, gameId);
  }

  /**
   * Return an array of panel DOM elements.
   * @returns {HTMLElement[]}
   */
  function getPanels() {
    return [..._panels];
  }

  /**
   * Launch a quiz game that takes over the full game container.
   * Quiz games share one question area and have per-player answer zones.
   * @param {number} playerCount
   * @param {string} gameId
   */
  function launchQuiz(playerCount, gameId) {
    destroy();

    const game = window.getGameById(gameId);
    if (!game) return;

    const container = document.getElementById('game-container');
    if (!container) return;

    container.classList.add('active');
    container.dataset.layout = 'quiz';
    container.innerHTML = '';

    _expectedPanels = playerCount;
    _endedScores = [];

    const quizEl = document.createElement('div');
    quizEl.style.cssText = 'width:100%;flex:1;min-height:0;overflow:hidden;';
    container.appendChild(quizEl);

    const myToken = _sessionToken;
    const _doInit = () => {
      if (myToken !== _sessionToken) return;
      const mod = window.GameModules && window.GameModules[gameId];
      if (!mod || typeof mod.init !== 'function') {
        quizEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">게임을 불러올 수 없어요</div></div>`;
        return;
      }
      const instance = mod.init(quizEl, {
        playerCount,
        playerColors: PLAYER_COLORS.slice(0, playerCount),
        onGameOver: (scores) => {
          if (myToken !== _sessionToken) return; // stale — user navigated away
          const sorted = (Array.isArray(scores) ? scores : []).map((s, i) =>
            typeof s === 'object' ? s : { playerIndex: i, score: s }
          );
          clearTimeout(_gameOverTimeout);
          _gameOverTimeout = setTimeout(() => {
            if (myToken !== _sessionToken) return; // double-check after delay
            if (typeof window.showGameOverOverlay === 'function') {
              window.showGameOverOverlay(sorted);
            }
          }, 600);
        },
      });
      _gameInstances[0] = instance;
    };

    if (window.GameModules && window.GameModules[gameId]) {
      _doInit();
      return;
    }

    const scriptId = `game-script-${gameId}`;
    if (_pendingCallbacks[gameId]) {
      _pendingCallbacks[gameId].push(_doInit);
      return;
    }
    _pendingCallbacks[gameId] = [_doInit];
    const script = document.createElement('script');
    script.id  = scriptId;
    script.src = `games/${game.entryFile}?v=${Date.now()}`;
    script.onload = () => {
      (_pendingCallbacks[gameId] || []).forEach(cb => cb());
      delete _pendingCallbacks[gameId];
    };
    script.onerror = () => {
      quizEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">게임 파일을 찾을 수 없어요</div></div>`;
      delete _pendingCallbacks[gameId];
    };
    document.head.appendChild(script);
  }

  return { build, destroy, loadGameInPanel, getPanels, launchQuiz, startTimer };

})();

// Expose globally
window.LayoutManager = LayoutManager;
