'use strict';
/**
 * visitor-counter.js
 * Tracks page visits using Supabase visits table.
 * One visit per browser session (sessionStorage dedup).
 */
(function () {
  const SUPABASE_URL  = '/sb';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0MzU2MTcyLCJleHAiOjE5MzIwMzYxNzJ9.Tte-16sqvVngAJTLJT7o2XNKV4b_WGAhaVtFf7Iy5dY';
  const SESSION_KEY   = 'visit_counted';
  const TIMEOUT_MS    = 4000;

  function sbFetch(url, opts = {}) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  function headers(extra = {}) {
    return {
      'apikey': SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async function recordVisit() {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    await sbFetch(`${SUPABASE_URL}/rest/v1/visits`, {
      method: 'POST',
      headers: headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({}),
    });
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  async function fetchCounts() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalRes, todayRes] = await Promise.all([
      sbFetch(`${SUPABASE_URL}/rest/v1/visits?select=id`, {
        headers: headers({ 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }),
      }),
      sbFetch(`${SUPABASE_URL}/rest/v1/visits?select=id&created_at=gte.${todayStart.toISOString()}`, {
        headers: headers({ 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }),
      }),
    ]);

    const total = parseInt(totalRes.headers.get('Content-Range')?.split('/')[1] ?? '0', 10);
    const today = parseInt(todayRes.headers.get('Content-Range')?.split('/')[1] ?? '0', 10);
    return { total, today };
  }

  function updateUI(today, total) {
    const el = document.getElementById('visitor-counter');
    if (!el) return;
    el.innerHTML = `오늘 <b>${today}</b>명 · 누적 <b>${total}</b>명`;
    el.style.display = 'inline-flex';
  }

  async function init() {
    try {
      await recordVisit();
      const { today, total } = await fetchCounts();
      updateUI(today, total);
    } catch {
      /* silently fail — counter is non-critical */
    }
  }

  window.VisitorCounter = { init };
})();
