'use strict';
/**
 * leaderboard.js
 * Supabase-backed leaderboard with time-period filtering.
 * Falls back to localStorage if Supabase is unreachable.
 */
(function () {
  const SUPABASE_URL  = 'http://144.24.68.246:8000';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0MzU2MTcyLCJleHAiOjE5MzIwMzYxNzJ9.Tte-16sqvVngAJTLJT7o2XNKV4b_WGAhaVtFf7Iy5dY';
  const LS_KEY        = 'lb_v1'; // localStorage fallback key

  /* Build from window.GAMES at call time so new games are always included */
  function getGameNames() {
    if (window.GAMES?.length) {
      const map = {};
      window.GAMES.forEach(g => { map[g.id] = g.name; });
      return map;
    }
    return {
      'number-pop':   '숫자 팡팡',   'color-match':  '색깔 맞추기',
      'math-race':    '수학 레이스',  'word-quiz':    '낱말 퀴즈',
      'memory-flip':  '기억 카드',    'rhythm-tap':   '리듬 탭',
      'tetris':       '테트리스',     'number-hunt':  '숫자 찾기',
      'minesweeper':  '지뢰찾기',     'breakout':     '블록 깨기',
      'snake':        '뱀 게임',      'number-bomb':  '숫자 폭탄',
      'times-quiz':   '구구단 배틀',  'number-slide': '넘버 슬라이드',
      'quiz-flags':   '국기 퀴즈',    'quiz-words':   '영어 단어',
      'drawing-game': '빨리 그리기',  'time-master':  '시간 지배자',
      'reaction-speed': '반응속도',   'perfect-circle': '완벽한 원',
    };
  }

  const TIMEOUT_MS = 4000; // fail fast so localStorage fallback kicks in quickly

  /* ── Supabase REST helpers ─────────────────────────────── */
  function sbHeaders() {
    return {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  function sbFetch(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(() => clearTimeout(timer));
  }

  async function sbInsert(game, name, score) {
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ game, player: name, score }),
    });
    if (!res.ok) throw new Error(`insert failed: ${res.status}`);
  }

  async function sbSelect(game, cutoff, limit) {
    const params = new URLSearchParams({
      select: 'player,score,created_at',
      game:   `eq.${game}`,
      order:  'score.desc',
      limit:  String(limit),
    });
    if (cutoff) params.set('created_at', `gte.${new Date(cutoff).toISOString()}`);
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/scores?${params}`, {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`select failed: ${res.status}`);
    return res.json();
  }

  let _allGamesCache = null;
  let _allGamesCacheTs = 0;

  async function sbGamesWithData() {
    // Use cache if fresh (60 s)
    if (_allGamesCache && Date.now() - _allGamesCacheTs < 60000) return _allGamesCache;
    const res = await sbFetch(`${SUPABASE_URL}/rest/v1/scores?select=game&limit=200`, {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`games query failed: ${res.status}`);
    const rows = await res.json();
    _allGamesCache = [...new Set(rows.map(r => r.game))];
    _allGamesCacheTs = Date.now();
    return _allGamesCache;
  }

  /* ── localStorage fallback helpers ────────────────────── */
  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
  }
  function lsSave(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); }

  function lsAdd(game, name, score) {
    const d = lsLoad();
    if (!d[game]) d[game] = [];
    d[game].push({ n: (name || '익명').trim().slice(0, 10), s: +score, t: Date.now() });
    d[game].sort((a, b) => b.s - a.s);
    if (d[game].length > 500) d[game].length = 500;
    lsSave(d);
  }

  function lsGet(game, period, limit) {
    const all = (lsLoad()[game] || []);
    const now = Date.now();
    const cutoff = { '오늘': now - 86400000, '이번주': now - 604800000, '이번달': now - 2592000000, '전체': 0 }[period] ?? 0;
    return all.filter(e => e.t >= cutoff).slice(0, limit).map(e => ({ player: e.n, score: e.s }));
  }

  /* ── Public API ────────────────────────────────────────── */
  const LB = {
    /* Save score — tries Supabase first, falls back to localStorage */
    add(game, name, score) {
      if (!game || score == null || isNaN(score)) return;
      const safeName = (name || '익명').trim().slice(0, 10);
      sbInsert(game, safeName, +score).catch(() => {
        lsAdd(game, safeName, score);
      });
    },

    /* Fetch top scores — returns a Promise */
    async get(game, period, limit = 10) {
      const now = Date.now();
      const cutoffMs = { '오늘': now - 86400000, '이번주': now - 604800000, '이번달': now - 2592000000, '전체': 0 }[period] ?? 0;
      try {
        return await sbSelect(game, cutoffMs || null, limit);
      } catch {
        return lsGet(game, period, limit);
      }
    },

    /* Check if any scores exist — returns a Promise */
    async hasData() {
      try {
        const res = await sbFetch(`${SUPABASE_URL}/rest/v1/scores?select=game&limit=1`, { headers: sbHeaders() });
        const rows = await res.json();
        return Array.isArray(rows) && rows.length > 0;
      } catch {
        const d = lsLoad();
        return Object.values(d).some(arr => arr.length > 0);
      }
    },

    get GAME_NAMES() { return getGameNames(); },

    /* Returns a Promise<string[]> of game ids that have scores */
    async allGames() {
      try {
        const games = await sbGamesWithData();
        return Object.keys(getGameNames()).filter(id => games.includes(id));
      } catch {
        const d = lsLoad();
        return Object.keys(getGameNames()).filter(g => d[g]?.length);
      }
    }
  };

  window.Leaderboard = LB;
})();
