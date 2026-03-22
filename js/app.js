/**
 * app.js
 * Main application entry point.
 *
 * Responsibilities:
 *  - Maintain the 16:9 letterbox stage at all window sizes
 *  - Handle screen transitions (player select → game container)
 *  - Wire up the player-count selection buttons
 *  - Show/hide the 4-player layout modal
 *  - Delegate to LayoutManager for panel construction
 */

'use strict';

/* ─────────────────────────────────────────────
   16:9 STAGE SIZING
   Keeps #stage exactly 16:9 regardless of window shape.
   ───────────────────────────────────────────── */

const ASPECT_RATIO = 16 / 9;

function resizeStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  const winW = window.innerWidth;
  const winH = window.innerHeight;

  let stageW, stageH;

  if (winW / winH > ASPECT_RATIO) {
    // Window is wider than 16:9 → letterbox left/right
    stageH = winH;
    stageW = winH * ASPECT_RATIO;
  } else {
    // Window is taller than 16:9 → letterbox top/bottom
    stageW = winW;
    stageH = winW / ASPECT_RATIO;
  }

  stage.style.setProperty('--stage-w', `${stageW}px`);
  stage.style.setProperty('--stage-h', `${stageH}px`);
}

/* ─────────────────────────────────────────────
   SCREEN ROUTING
   A "screen" is a full-stage <div> whose visibility
   is toggled by adding/removing the `active` class.
   ───────────────────────────────────────────── */

/**
 * Transition to a screen by its element id.
 * Hides all other screens first.
 * @param {string} screenId
 */
function showScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });

  // Show target screen
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }

  // Special case: game-container is not a .screen div
  const gc = document.getElementById('game-container');
  if (screenId === 'game-container') {
    gc?.classList.add('active');
  } else {
    gc?.classList.remove('active');
  }
}

/* ─────────────────────────────────────────────
   MODAL — 4-PLAYER LAYOUT CHOICE
   ───────────────────────────────────────────── */

const Modal = (() => {
  let _overlay = null;

  function _getOverlay() {
    if (!_overlay) _overlay = document.getElementById('modal-overlay');
    return _overlay;
  }

  function open() {
    _getOverlay()?.classList.add('open');
  }

  function close() {
    _getOverlay()?.classList.remove('open');
  }

  return { open, close };
})();

/* ─────────────────────────────────────────────
   PLAYER COUNT BUTTONS
   ───────────────────────────────────────────── */

/**
 * Called when a player-count button is tapped.
 * @param {number} count  1, 2, or 3 — bypasses modal
 */
function onPlayerCountSelected(count) {
  if (count === 4) {
    // Show layout choice modal for 4 players
    Modal.open();
  } else {
    startGame(count);
  }
}

/**
 * Build the layout and transition to the game container.
 * @param {number} playerCount
 * @param {'strips'|'grid'} [variant]
 */
function startGame(playerCount, variant = 'strips') {
  Modal.close();
  window.LayoutManager.build(playerCount, variant);

  // Hide the player-select screen and show the game container
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('game-container').classList.add('active');
}

/* ─────────────────────────────────────────────
   BACK TO MAIN MENU
   ───────────────────────────────────────────── */

function returnToMainMenu() {
  window.LayoutManager.destroy();
  showScreen('screen-player-select');
}

/* ─────────────────────────────────────────────
   DECORATIVE BACKGROUND STARS
   Sprinkle small glowing dots on the home screen.
   ───────────────────────────────────────────── */

function createBackgroundStars() {
  const screen = document.getElementById('screen-player-select');
  if (!screen) return;

  const starColors = [
    'var(--primary)',
    'var(--secondary)',
    'var(--tertiary)',
    'var(--color-player-4)',
  ];

  const count = 28;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'bg-star';

    const size = 4 + Math.random() * 10;   // 4–14 px
    star.style.width  = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left   = `${Math.random() * 100}%`;
    star.style.top    = `${Math.random() * 100}%`;
    star.style.background = starColors[Math.floor(Math.random() * starColors.length)];
    star.style.animationDelay    = `${Math.random() * 3}s`;
    star.style.animationDuration = `${2 + Math.random() * 3}s`;

    screen.appendChild(star);
  }
}

/* ─────────────────────────────────────────────
   ENTRANCE ANIMATIONS
   Stagger the player-count buttons bouncing in.
   ───────────────────────────────────────────── */

function animateHomeButtons() {
  const buttons = document.querySelectorAll('.player-count-btn');
  buttons.forEach((btn, i) => {
    btn.style.opacity    = '0';
    btn.style.transform  = 'scale(0.5) translateY(40px)';
    btn.style.transition = 'none';

    setTimeout(() => {
      btn.style.transition = `
        opacity     0.4s ease-out ${i * 100}ms,
        transform   0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 100}ms
      `;
      btn.style.opacity   = '';
      btn.style.transform = '';
    }, 80);   // tiny delay lets the browser paint first
  });

  // Title animation
  const title = document.querySelector('.home-title');
  if (title) {
    title.style.animation = 'titleDrop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both';
  }
}

/* ─────────────────────────────────────────────
   RIPPLE EFFECT ON BUTTONS
   Creates a radial ripple from the tap point.
   ───────────────────────────────────────────── */

function addRippleEffect(button) {
  const handler = (e) => {
    const rect = button.getBoundingClientRect();
    // Use touch coordinates if available
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top:  ${y}px;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      border-radius: 50%;
      background: rgba(255,255,255,0.35);
      pointer-events: none;
      animation: ripple 0.5s ease-out forwards;
    `;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  };

  button.addEventListener('touchstart', handler, { passive: true });
  button.addEventListener('mousedown',  handler);
}

/* ─────────────────────────────────────────────
   WIRING  —  Called once DOM is ready
   ───────────────────────────────────────────── */

function init() {
  // 1. Size the stage immediately and on every resize
  resizeStage();
  window.addEventListener('resize', resizeStage);

  // 2. Show the home screen
  showScreen('screen-player-select');

  // 3. Decorative elements
  createBackgroundStars();
  animateHomeButtons();

  // 4. Wire player-count buttons
  document.querySelectorAll('[data-player-count]').forEach(btn => {
    const count = parseInt(btn.dataset.playerCount, 10);

    const handler = (e) => {
      e.preventDefault();
      onPlayerCountSelected(count);
    };

    btn.addEventListener('click',    handler);
    btn.addEventListener('touchend', handler, { passive: false });
    addRippleEffect(btn);
  });

  // 5. Wire 4-player layout choice buttons inside the modal
  const layoutStrips = document.getElementById('btn-layout-strips');
  const layoutGrid   = document.getElementById('btn-layout-grid');
  const modalClose   = document.getElementById('btn-modal-close');

  if (layoutStrips) {
    const h = (e) => { e.preventDefault(); startGame(4, 'strips'); };
    layoutStrips.addEventListener('click',    h);
    layoutStrips.addEventListener('touchend', h, { passive: false });
    addRippleEffect(layoutStrips);
  }

  if (layoutGrid) {
    const h = (e) => { e.preventDefault(); startGame(4, 'grid'); };
    layoutGrid.addEventListener('click',    h);
    layoutGrid.addEventListener('touchend', h, { passive: false });
    addRippleEffect(layoutGrid);
  }

  if (modalClose) {
    modalClose.addEventListener('click',    Modal.close);
    modalClose.addEventListener('touchend', (e) => { e.preventDefault(); Modal.close(); }, { passive: false });
  }

  // 6. Close modal when clicking outside the card
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      Modal.close();
    }
  });

  // 7. Wire the "back to main menu" button (if present)
  document.getElementById('btn-main-menu')?.addEventListener('click', returnToMainMenu);

  // 8. Prevent context menu on long-press (common on touch screens)
  document.addEventListener('contextmenu', e => e.preventDefault());

  // 9. Prevent scrolling gestures from interfering with game input
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchstart', e => {
    // Allow default only on interactive elements
    if (!e.target.closest('button, .btn, .player-count-btn, .game-card, .bubble, .panel-back-btn')) {
      e.preventDefault();
    }
  }, { passive: false });
}

// Bootstrap when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose for debugging
window._App = { showScreen, startGame, returnToMainMenu, Modal };
