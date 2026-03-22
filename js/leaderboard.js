'use strict';
/**
 * leaderboard.js
 * localStorage-backed leaderboard with time-period filtering.
 */
(function () {
  const KEY = 'lb_v1';

  const GAME_NAMES = {
    'number-pop':   '숫자 팡팡',
    'color-match':  '색깔 맞추기',
    'math-race':    '수학 레이스',
    'word-quiz':    '낱말 퀴즈',
    'memory-flip':  '기억 카드',
    'rhythm-tap':   '리듬 탭',
    'tetris':       '테트리스',
    'number-hunt':  '숫자 찾기',
    'minesweeper':  '지뢰찾기',
    'breakout':     '블록 깨기',
    'snake':        '뱀 게임',
    'number-bomb':  '숫자 폭탄',
    'times-quiz':   '구구단 배틀',
    'number-slide': '넘버 슬라이드',
    'quiz-flags':   '국기 퀴즈',
    'quiz-words':   '영어 단어',
  };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  const LB = {
    GAME_NAMES,

    add(game, name, score) {
      if (!game || score == null || isNaN(score)) return;
      const d = load();
      if (!d[game]) d[game] = [];
      d[game].push({ n: (name || '익명').trim().slice(0, 10), s: +score, t: Date.now() });
      d[game].sort((a, b) => b.s - a.s);
      if (d[game].length > 500) d[game].length = 500;
      save(d);
    },

    get(game, period, limit = 10) {
      const all = (load()[game] || []);
      const now = Date.now();
      const cutoff = { '오늘': now - 86400000, '이번주': now - 604800000, '이번달': now - 2592000000, '전체': 0 }[period] ?? 0;
      return all.filter(e => e.t >= cutoff).slice(0, limit);
    },

    hasData() {
      const d = load();
      return Object.values(d).some(arr => arr.length > 0);
    },

    allGames() {
      const d = load();
      return Object.keys(GAME_NAMES).filter(g => d[g]?.length);
    }
  };

  window.Leaderboard = LB;
})();
