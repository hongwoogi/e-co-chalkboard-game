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

  function computeRounds(N, M, A) {
    const rounds = [];
    let slots = N;
    while (slots > A || (slots > 1 && rounds.length === 0)) {
      const matchCount = Math.ceil(slots / M);
      rounds.push(matchCount);
      slots = matchCount * A;
      if (matchCount === 1) break;
    }
    return rounds;
  }

  function buildBracket(N, M, A) {
    const roundCounts = computeRounds(N, M, A);
    return roundCounts.map((matchCount) => {
      const matches = [];
      for (let mi = 0; mi < matchCount; mi++) {
        matches.push({ players: new Array(M).fill(null), winners: [] });
      }
      return matches;
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function assignParticipants(bracket, N, M) {
    const nums = Array.from({ length: N }, (_, i) => String(i + 1));
    shuffle(nums);
    let idx = 0;
    for (const match of bracket[0]) {
      for (let s = 0; s < match.players.length; s++) {
        match.players[s] = idx < nums.length ? nums[idx++] : null;
      }
    }
    return nums;
  }

  /** Draw SVG bracket connector lines between rounds */
  function drawConnectors(bracket, roundEls, connEls) {
    bracket.forEach((round, ri) => {
      if (ri >= bracket.length - 1) return;
      const nextRound = bracket[ri + 1];
      const connEl = connEls[ri];
      const connRect = connEl.getBoundingClientRect();
      if (connRect.height === 0) return;

      const curMatches = roundEls[ri].querySelectorAll('.tm-match');
      const nextMatches = roundEls[ri + 1].querySelectorAll('.tm-match');
      const groupSize = Math.ceil(round.length / nextRound.length);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';

      nextMatches.forEach((nextMatchEl, nmi) => {
        const nextRect = nextMatchEl.getBoundingClientRect();
        const destY = nextRect.top + nextRect.height / 2 - connRect.top;
        const destX = connRect.width;
        const midX = connRect.width / 2;

        const srcStart = nmi * groupSize;
        const srcEnd = Math.min(srcStart + groupSize, curMatches.length);
        const srcYs = [];
        for (let i = srcStart; i < srcEnd; i++) {
          const r = curMatches[i].getBoundingClientRect();
          srcYs.push(r.top + r.height / 2 - connRect.top);
        }
        if (srcYs.length === 0) return;

        const color = 'rgba(200,160,110,0.6)';
        const strokeW = '2';

        // Horizontal lines from each source to midX
        srcYs.forEach(sy => {
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          p.setAttribute('x1', 0); p.setAttribute('y1', sy);
          p.setAttribute('x2', midX); p.setAttribute('y2', sy);
          p.setAttribute('stroke', color); p.setAttribute('stroke-width', strokeW);
          svg.appendChild(p);
        });

        // Vertical joining bracket
        if (srcYs.length > 1) {
          const topY = Math.min(...srcYs);
          const botY = Math.max(...srcYs);
          const vl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          vl.setAttribute('x1', midX); vl.setAttribute('y1', topY);
          vl.setAttribute('x2', midX); vl.setAttribute('y2', botY);
          vl.setAttribute('stroke', color); vl.setAttribute('stroke-width', strokeW);
          svg.appendChild(vl);
        }

        // Horizontal line from midX to destination
        const midY = (Math.min(...srcYs) + Math.max(...srcYs)) / 2;
        const hl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hl.setAttribute('x1', midX); hl.setAttribute('y1', midY);
        hl.setAttribute('x2', destX); hl.setAttribute('y2', destY);
        hl.setAttribute('stroke', color); hl.setAttribute('stroke-width', strokeW);
        svg.appendChild(hl);

        // Dot at destination
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', destX); dot.setAttribute('cy', destY);
        dot.setAttribute('r', '3');
        dot.setAttribute('fill', 'rgba(200,160,110,0.7)');
        svg.appendChild(dot);
      });

      connEl.appendChild(svg);
    });
  }

  function openModal() {
    if (document.getElementById('tournament-modal')) return;

    const existing = load();

    // ── Overlay (matches lb-modal) ──
    const overlay = document.createElement('div');
    overlay.id = 'tournament-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      padding: clamp(0.6rem,2vw,2rem);
    `;

    // ── Card (matches lb-card warm theme) ──
    const card = document.createElement('div');
    card.style.cssText = `
      background: #fffdf8;
      border-radius: clamp(1rem,2vw,1.8rem);
      width: min(96vw, 1100px);
      height: min(92vh, 820px);
      display: flex; flex-direction: column;
      box-shadow: 0 8px 48px rgba(0,0,0,0.18);
      border: 1.5px solid rgba(200,160,110,0.22);
      overflow: hidden;
      animation: bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
    `;

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: clamp(1rem,2vw,1.6rem) clamp(1.2rem,2.5vw,2rem);
      border-bottom: 2px solid rgba(200,160,110,0.15);
      flex-shrink: 0;
    `;
    header.innerHTML = `
      <span style="font-family:var(--font-display);font-size:clamp(1.4rem,2.8vw,2.2rem);color:#2c1a0e;">🏆 토너먼트</span>
      <button id="tm-close-btn" style="background:rgba(180,130,80,0.1);border:none;font-size:1.3rem;width:2.2em;height:2.2em;border-radius:50%;cursor:pointer;color:#7a5535;display:flex;align-items:center;justify-content:center;transition:background 0.12s;">✕</button>
    `;

    // ── Body (sidebar + bracket) ──
    const body = document.createElement('div');
    body.style.cssText = `display:flex;flex:1;min-height:0;overflow:hidden;`;

    // ── Sidebar ──
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 200px; flex-shrink: 0;
      background: #fff8ef;
      border-right: 2px solid rgba(200,160,110,0.18);
      display: flex; flex-direction: column;
      padding: 1.2rem 1rem; gap: 0.9rem; overflow-y: auto;
    `;

    function labelCss() { return 'font-size:0.8rem;color:#b08060;font-family:var(--font-body);font-weight:800;letter-spacing:0.04em;'; }
    function controlBtnCss() { return 'width:2rem;height:2rem;border:1.5px solid rgba(200,160,110,0.3);border-radius:0.4rem;background:rgba(200,160,110,0.08);color:#5a3e2b;font-size:1.1rem;cursor:pointer;'; }
    function selectCss() { return 'padding:0.4rem 0.5rem;border-radius:0.6rem;border:1.5px solid rgba(200,160,110,0.25);background:#fff;color:#3d2b1f;font-family:var(--font-body);font-size:0.9rem;width:100%;'; }
    function primaryBtnCss(bg, fg) { return `padding:0.55rem 0.8rem;border-radius:999px;border:none;background:${bg};color:${fg};font-family:var(--font-body);font-size:0.88rem;cursor:pointer;font-weight:700;width:100%;transition:filter 0.12s;`; }

    sidebar.innerHTML = `
      <div>
        <span style="${labelCss()}">👥 총 참가 인원</span>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;">
          <button id="tm-n-dec" style="${controlBtnCss()}">−</button>
          <span id="tm-n-val" style="font-family:var(--font-display);font-size:1.5rem;color:#3d2b1f;flex:1;text-align:center;">${existing ? existing.totalPlayers : 8}</span>
          <button id="tm-n-inc" style="${controlBtnCss()}">+</button>
        </div>
      </div>
      <div>
        <span style="${labelCss()}">⚔️ 경기당 인원</span>
        <select id="tm-m-sel" style="${selectCss()};margin-top:0.4rem;">${[2,3,4].map(v=>`<option value="${v}" ${(existing?existing.playersPerMatch:2)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <div>
        <span style="${labelCss()}">🥇 진출 인원</span>
        <select id="tm-a-sel" style="${selectCss()};margin-top:0.4rem;">${[1,2,3].map(v=>`<option value="${v}" ${(existing?existing.advancingPerMatch:1)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <div style="height:1px;background:rgba(200,160,110,0.18);margin:0.2rem 0;"></div>
      <button id="tm-generate-btn" style="${primaryBtnCss('#ff8c42','#fff')}">🎲 대진표 작성하기</button>
      <button id="tm-apply-btn" style="${primaryBtnCss('#4f86f7','#fff')}">✅ 적용하기</button>
      <button id="tm-clear-btn" style="${primaryBtnCss('transparent','#e53935')};border:1.5px solid rgba(229,57,53,0.35);">🗑 초기화</button>
    `;

    // ── Bracket area ──
    const bracketArea = document.createElement('div');
    bracketArea.style.cssText = `
      flex: 1; overflow: auto; padding: 1.5rem;
      display: flex; align-items: center;
      min-width: 0;
    `;

    const bracketEl = document.createElement('div');
    bracketEl.id = 'tm-bracket';
    bracketEl.style.cssText = `
      display: flex; flex-direction: row; gap: 0; align-items: stretch;
      min-height: 300px; position: relative;
    `;
    bracketArea.appendChild(bracketEl);

    body.appendChild(sidebar);
    body.appendChild(bracketArea);
    card.appendChild(header);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // ── State ──
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

    function getRoundLabel(ri, total) {
      if (ri === total - 1) return '🏆 결승';
      if (ri === total - 2 && total > 2) return '준결승';
      return `${ri + 1}라운드`;
    }

    function renderBracket() {
      bracketEl.innerHTML = '';
      if (!generated) {
        bracketEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;min-width:320px;color:#b08060;font-family:var(--font-body);font-size:1rem;text-align:center;">"대진표 작성하기" 버튼을 눌러주세요.</div>`;
        return;
      }

      const totalRounds = bracket.length;
      const roundEls = [];
      const connEls = [];

      bracket.forEach((round, ri) => {
        const col = document.createElement('div');
        col.style.cssText = `
          display: flex; flex-direction: column; flex-shrink: 0;
          width: 110px;
        `;

        const roundLabel = document.createElement('div');
        roundLabel.style.cssText = `
          font-family: var(--font-body); font-size: 0.72rem; font-weight: 800;
          color: #b08060; text-align: center; letter-spacing: 0.04em;
          padding: 0 0 0.5rem 0; flex-shrink: 0;
        `;
        roundLabel.textContent = getRoundLabel(ri, totalRounds);
        col.appendChild(roundLabel);

        const matchesWrap = document.createElement('div');
        matchesWrap.style.cssText = `
          display: flex; flex-direction: column;
          justify-content: space-around; flex: 1; gap: 0;
        `;

        round.forEach((match, mi) => {
          const matchEl = document.createElement('div');
          matchEl.className = 'tm-match';
          matchEl.style.cssText = `
            background: #fff;
            border: 1.5px solid rgba(200,160,110,0.35);
            border-radius: 0.6rem;
            overflow: hidden;
            margin: 4px 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          `;

          // Add wrapper for spacing (to center match in available space)
          const matchWrap = document.createElement('div');
          matchWrap.style.cssText = `flex:1;display:flex;flex-direction:column;justify-content:center;min-height:${ri === 0 ? M * 28 + 8 : M * 28 + 8}px;`;
          matchWrap.appendChild(matchEl);
          matchesWrap.appendChild(matchWrap);

          const slots = ri === 0 ? match.players : new Array(M).fill(null);
          slots.forEach((player, si) => {
            const slot = document.createElement('div');
            slot.style.cssText = `
              padding: 0.28rem 0.5rem;
              font-family: var(--font-display);
              font-size: 0.82rem;
              color: ${player ? '#2c1a0e' : '#c8a06e'};
              background: ${si % 2 === 0 ? 'rgba(200,160,110,0.05)' : '#fff'};
              border-top: ${si > 0 ? '1px solid rgba(200,160,110,0.15)' : 'none'};
              min-height: 26px;
              display: flex; align-items: center;
            `;
            slot.textContent = ri === 0 ? (player ? `${player}번` : '—') : '?';
            matchEl.appendChild(slot);
          });
        });

        col.appendChild(matchesWrap);
        bracketEl.appendChild(col);
        roundEls.push(col);

        // Connector column
        if (ri < totalRounds - 1) {
          const conn = document.createElement('div');
          conn.style.cssText = `width:44px;flex-shrink:0;position:relative;align-self:stretch;`;
          bracketEl.appendChild(conn);
          connEls.push(conn);
        }
      });

      // Draw SVG connectors after layout
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drawConnectors(bracket, roundEls, connEls);
        });
      });
    }

    // ── Event wiring ──
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
    btn.classList.toggle('active', active);
  }

  window.TournamentManager = {
    open: openModal,
    isActive: () => !!(load()?.active),
    init() {
      if (this.isActive()) updateTournamentBtn(true);
    }
  };
})();
