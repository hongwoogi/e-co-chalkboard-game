'use strict';
/**
 * tournament.js — Tournament bracket manager
 * Saved to localStorage under key 'tournament_v1'
 */
(function () {

  const KEY = 'tournament_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function clear() { localStorage.removeItem(KEY); }

  /** Compute round structure given N players, M per match, A advancing */
  function computeRounds(N, M, A) {
    const rounds = [];
    let slots = N;
    while (slots > A || (slots > 1 && rounds.length === 0)) {
      const matchCount = Math.ceil(slots / M);
      rounds.push(matchCount);
      slots = matchCount * A;
      if (matchCount === 1) break;
    }
    return rounds; // array of match counts per round
  }

  /** Build a blank bracket structure */
  function buildBracket(N, M, A) {
    const roundCounts = computeRounds(N, M, A);
    return roundCounts.map((matchCount, ri) => {
      const matches = [];
      for (let mi = 0; mi < matchCount; mi++) {
        const playersInMatch = ri === 0 ? M : M; // all rounds same M (byes handled by null)
        matches.push({ players: new Array(playersInMatch).fill(null), winners: [] });
      }
      return matches;
    });
  }

  /** Shuffle array in place */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Assign random numbers to first round slots */
  function assignParticipants(bracket, N, M) {
    const nums = Array.from({ length: N }, (_, i) => String(i + 1));
    shuffle(nums);
    let idx = 0;
    const round0 = bracket[0];
    for (const match of round0) {
      for (let s = 0; s < match.players.length; s++) {
        match.players[s] = idx < nums.length ? nums[idx++] : null;
      }
    }
    return nums;
  }

  /** Open the tournament modal */
  function openModal() {
    if (document.getElementById('tournament-modal')) return;

    const existing = load();

    const overlay = document.createElement('div');
    overlay.id = 'tournament-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      width: min(96vw, 1100px); height: min(92vh, 800px);
      background: #1e1a14; border-radius: 1.2rem;
      display: flex; overflow: hidden;
      box-shadow: 0 8px 48px rgba(0,0,0,0.6);
      border: 1.5px solid rgba(255,200,100,0.18);
    `;

    function btnSmallCss() {
      return `width:2rem;height:2rem;border:1px solid rgba(255,255,255,0.2);border-radius:0.4rem;background:rgba(255,255,255,0.08);color:#fff;font-size:1.1rem;cursor:pointer;`;
    }
    function selectCss() {
      return `padding:0.4rem 0.5rem;border-radius:0.5rem;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;font-family:var(--font-body);font-size:0.9rem;width:100%;`;
    }
    function primaryBtnCss(bg, color) {
      return `padding:0.6rem 0.8rem;border-radius:0.7rem;border:none;background:${bg};color:${color};font-family:var(--font-display);font-size:0.95rem;cursor:pointer;font-weight:bold;`;
    }

    /* ── Sidebar ── */
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 220px; flex-shrink: 0;
      background: rgba(255,255,255,0.04);
      border-right: 1px solid rgba(255,255,255,0.08);
      display: flex; flex-direction: column;
      padding: 1.2rem 1rem; gap: 1rem; overflow-y: auto;
    `;

    sidebar.innerHTML = `
      <div style="font-family:var(--font-display);font-size:1.3rem;color:#fdd835;margin-bottom:0.2rem;">🏆 토너먼트</div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        <label style="font-size:0.82rem;color:#aaa;font-family:var(--font-body);">총 참가 인원</label>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <button id="tm-n-dec" style="${btnSmallCss()}">−</button>
          <span id="tm-n-val" style="font-family:var(--font-display);font-size:1.4rem;color:#fff;min-width:2.5rem;text-align:center;">${existing ? existing.totalPlayers : 8}</span>
          <button id="tm-n-inc" style="${btnSmallCss()}">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        <label style="font-size:0.82rem;color:#aaa;font-family:var(--font-body);">경기당 인원</label>
        <select id="tm-m-sel" style="${selectCss()}">${[2,3,4].map(v=>`<option value="${v}" ${(existing ? existing.playersPerMatch : 2)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        <label style="font-size:0.82rem;color:#aaa;font-family:var(--font-body);">진출 인원</label>
        <select id="tm-a-sel" style="${selectCss()}">${[1,2,3].map(v=>`<option value="${v}" ${(existing ? existing.advancingPerMatch : 1)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:0;">
      <button id="tm-generate-btn" style="${primaryBtnCss('#fdd835','#1a1008')}">🎲 대진표 작성하기</button>
      <button id="tm-apply-btn" style="${primaryBtnCss('#66bb6a','#fff')}">✅ 적용하기</button>
      <button id="tm-clear-btn" style="background:transparent;border:1px solid rgba(239,83,80,0.4);color:#ef5350;border-radius:0.6rem;padding:0.5rem;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;">🗑 초기화</button>
      <div style="flex:1;"></div>
      <button id="tm-close-btn" style="background:transparent;border:none;color:#888;font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;">✕ 닫기</button>
    `;

    /* ── Main bracket area ── */
    const main = document.createElement('div');
    main.id = 'tm-bracket-area';
    main.style.cssText = `
      flex: 1; overflow: auto; padding: 1.5rem;
      display: flex; align-items: flex-start; justify-content: flex-start;
      min-width: 0;
    `;

    const bracketEl = document.createElement('div');
    bracketEl.id = 'tm-bracket';
    bracketEl.style.cssText = `
      display: flex; flex-direction: row; gap: 2rem;
      align-items: stretch; min-height: 100%;
    `;
    main.appendChild(bracketEl);

    modal.appendChild(sidebar);
    modal.appendChild(main);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    /* ── State ── */
    let N = existing ? existing.totalPlayers : 8;
    let M = existing ? existing.playersPerMatch : 2;
    let A = existing ? existing.advancingPerMatch : 1;
    let bracket = existing ? existing.bracket : buildBracket(N, M, A);
    let generated = !!existing;

    function updateAOptions() {
      const sel = document.getElementById('tm-a-sel');
      if (!sel) return;
      const cur = parseInt(sel.value) || 1;
      sel.innerHTML = Array.from({ length: M - 1 }, (_, i) => i + 1)
        .map(v => `<option value="${v}" ${v === Math.min(cur, M - 1) ? 'selected' : ''}>${v}명</option>`)
        .join('');
      A = Math.min(cur, M - 1);
    }

    function renderBracket() {
      bracketEl.innerHTML = '';
      if (!generated) {
        bracketEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;color:#555;font-family:var(--font-body);font-size:1rem;">"대진표 작성하기" 버튼을 눌러주세요.</div>`;
        return;
      }
      const totalRounds = bracket.length;

      bracket.forEach((round, ri) => {
        const col = document.createElement('div');
        col.style.cssText = `
          display: flex; flex-direction: column;
          justify-content: space-around; gap: 0.5rem; flex-shrink: 0;
          min-width: 120px;
        `;

        const roundLabel = document.createElement('div');
        roundLabel.style.cssText = `font-family:var(--font-display);font-size:0.78rem;color:#888;text-align:center;margin-bottom:0.3rem;`;
        roundLabel.textContent = ri === totalRounds - 1 ? '🏆 결승' : `${ri + 1}라운드`;
        col.appendChild(roundLabel);

        const matchesWrap = document.createElement('div');
        matchesWrap.style.cssText = `display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:0.5rem;`;

        round.forEach((match, mi) => {
          const matchEl = document.createElement('div');
          matchEl.style.cssText = `
            background: rgba(255,255,255,0.06);
            border: 1.5px solid rgba(255,255,255,0.12);
            border-radius: 0.6rem; overflow: hidden;
            display: flex; flex-direction: column;
          `;

          const slots = ri === 0 ? match.players : new Array(M).fill(null);
          slots.forEach((player, si) => {
            const slot = document.createElement('div');
            slot.style.cssText = `
              padding: 0.35rem 0.6rem;
              font-family: var(--font-display);
              font-size: 0.9rem;
              color: ${player ? '#fff' : '#444'};
              background: ${si % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'};
              border-top: ${si > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none'};
              min-height: 1.8rem;
              display: flex; align-items: center;
            `;
            slot.textContent = ri === 0 ? (player ? `${player}번` : '—') : '?';
            matchEl.appendChild(slot);
          });

          matchesWrap.appendChild(matchEl);
        });

        col.appendChild(matchesWrap);
        bracketEl.appendChild(col);

        // Connector lines (except after last round)
        if (ri < totalRounds - 1) {
          const connector = document.createElement('div');
          connector.style.cssText = `
            display: flex; flex-direction: column;
            justify-content: space-around; flex-shrink: 0; width: 1.5rem;
            align-self: stretch;
          `;
          const nextRound = bracket[ri + 1];
          const groupSize = Math.ceil(round.length / nextRound.length);
          nextRound.forEach((_, nmi) => {
            const arrow = document.createElement('div');
            arrow.style.cssText = `
              flex: ${groupSize}; display: flex; align-items: center;
              justify-content: center; color: #555; font-size: 1rem;
            `;
            arrow.textContent = '→';
            connector.appendChild(arrow);
          });
          bracketEl.appendChild(connector);
        }
      });
    }

    /* ── Event wiring ── */
    const nValEl = document.getElementById('tm-n-val');
    document.getElementById('tm-n-dec').addEventListener('click', () => {
      N = Math.max(2, N - 1); nValEl.textContent = N; generated = false; renderBracket();
    });
    document.getElementById('tm-n-inc').addEventListener('click', () => {
      N = Math.min(64, N + 1); nValEl.textContent = N; generated = false; renderBracket();
    });
    document.getElementById('tm-m-sel').addEventListener('change', e => {
      M = parseInt(e.target.value); updateAOptions(); generated = false; renderBracket();
    });
    document.getElementById('tm-a-sel').addEventListener('change', e => {
      A = parseInt(e.target.value);
    });

    document.getElementById('tm-generate-btn').addEventListener('click', () => {
      A = parseInt(document.getElementById('tm-a-sel').value) || 1;
      bracket = buildBracket(N, M, A);
      assignParticipants(bracket, N, M);
      generated = true;
      renderBracket();
    });

    document.getElementById('tm-apply-btn').addEventListener('click', () => {
      if (!generated) { alert('먼저 대진표를 작성해주세요!'); return; }
      save({ totalPlayers: N, playersPerMatch: M, advancingPerMatch: A, bracket, active: true });
      updateTournamentBtn(true);
      overlay.remove();
    });

    document.getElementById('tm-clear-btn').addEventListener('click', () => {
      clear();
      updateTournamentBtn(false);
      generated = false;
      bracket = buildBracket(N, M, A);
      renderBracket();
    });

    document.getElementById('tm-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    renderBracket();
  }

  function updateTournamentBtn(active) {
    const btn = document.getElementById('btn-tournament');
    if (!btn) return;
    if (active) {
      btn.style.background = '#fdd835';
      btn.style.color = '#1a1008';
      btn.style.borderColor = '#fdd835';
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }

  /* ── Init ── */
  window.TournamentManager = {
    open: openModal,
    isActive: () => !!(load()?.active),
    init() {
      if (this.isActive()) updateTournamentBtn(true);
    }
  };
})();
