'use strict';
/**
 * tournament.js — Tournament bracket manager
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
    return computeRounds(N, M, A).map(matchCount =>
      Array.from({ length: matchCount }, () => ({ players: new Array(M).fill(null), winner: null }))
    );
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function assignParticipants(bracket, N, M) {
    const nums = shuffle(Array.from({ length: N }, (_, i) => String(i + 1)));
    let idx = 0;
    // Sequential assignment: byes naturally fall at the END (last match gets null slots)
    for (const match of bracket[0]) {
      for (let s = 0; s < M; s++) {
        match.players[s] = idx < nums.length ? nums[idx++] : null;
      }
    }
    return nums;
  }

  /** Draw SVG bracket connector lines with alternating-shift grouping.
   *  Even transitions (ri=0,2,...): shift remainder to front → bye moves to start of next round
   *  Odd transitions (ri=1,3,...): normal grouping → bye falls to end again
   *  Result: bye-receiver never gets two consecutive byes.
   */
  function drawConnectors(bracket, roundEls, connEls) {
    const M = bracket[0][0].players.length; // players per match

    bracket.forEach((round, ri) => {
      if (ri >= bracket.length - 1) return;
      const connEl = connEls[ri];
      const connRect = connEl.getBoundingClientRect();
      if (connRect.height === 0) return;

      const curMatches = Array.from(roundEls[ri].querySelectorAll('.tm-match'));
      const nextMatches = Array.from(roundEls[ri + 1].querySelectorAll('.tm-match'));
      const numInputs = curMatches.length;
      const remainder = numInputs % M;

      // Even transitions: shift remainder to front (bye moves from end → start)
      const useShift = remainder > 0 && ri % 2 === 0;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;';
      const color = 'rgba(200,160,110,0.65)';

      nextMatches.forEach((nextMatchEl, nmi) => {
        const nextRect = nextMatchEl.getBoundingClientRect();
        const destY = nextRect.top + nextRect.height / 2 - connRect.top;
        const midX = connRect.width / 2;

        // Compute source index range for this next-round match
        let srcStart, srcCount;
        if (useShift) {
          // First group gets only `remainder` sources (bye at start of next round)
          // subsequent groups get M sources each
          srcStart = nmi === 0 ? 0 : remainder + (nmi - 1) * M;
          srcCount = nmi === 0 ? remainder : M;
        } else {
          // Normal: each group gets M sources, last may have fewer
          srcStart = nmi * M;
          srcCount = M;
        }

        const srcYs = [];
        for (let k = 0; k < srcCount; k++) {
          const idx = srcStart + k;
          if (idx < curMatches.length) {
            const r = curMatches[idx].getBoundingClientRect();
            srcYs.push(r.top + r.height / 2 - connRect.top);
          }
        }
        if (!srcYs.length) return;

        const addLine = (x1, y1, x2, y2) => {
          const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', x1); l.setAttribute('y1', y1);
          l.setAttribute('x2', x2); l.setAttribute('y2', y2);
          l.setAttribute('stroke', color); l.setAttribute('stroke-width', '2');
          svg.appendChild(l);
        };

        srcYs.forEach(sy => addLine(0, sy, midX, sy));
        if (srcYs.length > 1) addLine(midX, Math.min(...srcYs), midX, Math.max(...srcYs));
        const midY = (Math.min(...srcYs) + Math.max(...srcYs)) / 2;
        addLine(midX, midY, connRect.width, destY);

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', connRect.width); dot.setAttribute('cy', destY);
        dot.setAttribute('r', '3'); dot.setAttribute('fill', 'rgba(200,160,110,0.8)');
        svg.appendChild(dot);
      });

      connEl.appendChild(svg);
    });
  }

  /** Animate slot-machine reveal for assigned players */
  function animateAssignments(bracket, roundEls, N) {
    const slots = [];
    // Collect all first-round slot elements and their target values
    const round0El = roundEls[0];
    const matchEls = round0El.querySelectorAll('.tm-match');
    bracket[0].forEach((match, mi) => {
      const matchEl = matchEls[mi];
      if (!matchEl) return;
      const slotEls = matchEl.querySelectorAll('.tm-slot');
      match.players.forEach((player, si) => {
        if (slotEls[si]) slots.push({ el: slotEls[si], value: player });
      });
    });

    slots.forEach(({ el, value }, idx) => {
      setTimeout(() => {
        let ticks = 0;
        const maxTicks = 10 + Math.floor(Math.random() * 6);
        function tick() {
          el.textContent = Math.floor(Math.random() * N) + 1 + '번';
          el.style.color = '#ff8c42';
          el.style.fontWeight = '900';
          ticks++;
          if (ticks < maxTicks) {
            setTimeout(tick, 40 + ticks * 12);
          } else {
            el.textContent = value ? `${value}번` : '—';
            el.style.color = value ? '#2c1a0e' : '#c8a06e';
            el.style.fontWeight = value ? '800' : '400';
            el.style.transition = 'transform 0.2s';
            el.style.transform = 'scale(1.18)';
            setTimeout(() => { el.style.transform = 'scale(1)'; }, 220);
          }
        }
        tick();
      }, idx * 160 + 200);
    });
  }

  function openModal() {
    if (document.getElementById('tournament-modal')) return;

    const existing = load();

    const overlay = document.createElement('div');
    overlay.id = 'tournament-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9000;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.55);
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      padding:clamp(0.6rem,2vw,2rem);
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background:#fffdf8;
      border-radius:clamp(1rem,2vw,1.8rem);
      width:min(96vw,1100px);height:min(92vh,820px);
      display:flex;flex-direction:column;
      box-shadow:0 8px 48px rgba(0,0,0,0.18);
      border:1.5px solid rgba(200,160,110,0.22);
      overflow:hidden;
      animation:bounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:clamp(1rem,2vw,1.6rem) clamp(1.2rem,2.5vw,2rem);
      border-bottom:2px solid rgba(200,160,110,0.15);flex-shrink:0;
    `;
    header.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.2rem;">
        <span style="font-family:var(--font-display);font-size:clamp(1.4rem,2.8vw,2.2rem);color:#2c1a0e;">🏆 토너먼트</span>
        <span id="tm-status" style="display:none;font-family:var(--font-body);font-size:0.85rem;font-weight:700;color:#ff8c42;"></span>
      </div>
      <button id="tm-close-btn" style="background:rgba(180,130,80,0.1);border:none;font-size:1.3rem;width:2.2em;height:2.2em;border-radius:50%;cursor:pointer;color:#7a5535;display:flex;align-items:center;justify-content:center;">✕</button>
    `;

    // Body
    const body = document.createElement('div');
    body.style.cssText = `display:flex;flex:1;min-height:0;overflow:hidden;`;

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width:200px;flex-shrink:0;
      background:#fff8ef;
      border-right:2px solid rgba(200,160,110,0.18);
      display:flex;flex-direction:column;
      padding:1.2rem 1rem;gap:0.9rem;overflow-y:auto;
    `;

    const lbl = () => 'font-size:0.8rem;color:#b08060;font-family:var(--font-body);font-weight:800;letter-spacing:0.04em;';
    const ctrlBtn = () => 'width:2rem;height:2rem;border:1.5px solid rgba(200,160,110,0.3);border-radius:0.4rem;background:rgba(200,160,110,0.08);color:#5a3e2b;font-size:1.1rem;cursor:pointer;flex-shrink:0;';
    const sel = () => 'padding:0.4rem 0.5rem;border-radius:0.6rem;border:1.5px solid rgba(200,160,110,0.25);background:#fff;color:#3d2b1f;font-family:var(--font-body);font-size:0.9rem;width:100%;margin-top:0.4rem;';
    const pbtn = (bg, fg, extra) => `padding:0.55rem 0.8rem;border-radius:999px;border:none;background:${bg};color:${fg};font-family:var(--font-body);font-size:0.88rem;cursor:pointer;font-weight:700;width:100%;${extra||''}`;

    sidebar.innerHTML = `
      <div>
        <span style="${lbl()}">👥 총 참가 인원</span>
        <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.4rem;">
          <button id="tm-n-dec" style="${ctrlBtn()}">−</button>
          <input id="tm-n-input" type="number" min="2" max="64" value="${existing ? existing.totalPlayers : 8}"
            style="width:0;flex:1;border:1.5px solid rgba(200,160,110,0.3);border-radius:0.5rem;padding:0.3rem 0.3rem;font-family:var(--font-display);font-size:1.3rem;color:#3d2b1f;text-align:center;background:#fff;min-width:0;" />
          <button id="tm-n-inc" style="${ctrlBtn()}">+</button>
        </div>
      </div>
      <div>
        <span style="${lbl()}">⚔️ 경기당 인원</span>
        <select id="tm-m-sel" style="${sel()}">${[2,3,4].map(v=>`<option value="${v}" ${(existing?existing.playersPerMatch:2)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <div>
        <span style="${lbl()}">🥇 진출 인원</span>
        <select id="tm-a-sel" style="${sel()}">${[1,2,3].map(v=>`<option value="${v}" ${(existing?existing.advancingPerMatch:1)==v?'selected':''}>${v}명</option>`).join('')}</select>
      </div>
      <div style="height:1px;background:rgba(200,160,110,0.18);"></div>
      <button id="tm-generate-btn" style="${pbtn('#ff8c42','#fff')}">🎲 대진표 작성하기</button>
      <button id="tm-apply-btn" style="${pbtn('#4f86f7','#fff')}">✅ 적용하기</button>
      <button id="tm-clear-btn" style="${pbtn('transparent','#e53935')}border:1.5px solid rgba(229,57,53,0.35);">🗑 초기화</button>
    `;

    // Bracket area
    const bracketArea = document.createElement('div');
    bracketArea.id = 'tm-bracket-area';
    bracketArea.style.cssText = `flex:1;overflow:auto;padding:1.5rem;display:flex;flex-direction:column;align-items:flex-start;min-width:0;`;

    const bracketEl = document.createElement('div');
    bracketEl.id = 'tm-bracket';
    bracketEl.style.cssText = `display:flex;flex-direction:row;gap:0;align-items:stretch;`;
    bracketArea.appendChild(bracketEl);

    body.appendChild(sidebar);
    body.appendChild(bracketArea);
    card.appendChild(header);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // State
    let N = existing ? existing.totalPlayers : 8;
    let M = existing ? existing.playersPerMatch : 2;
    let A = existing ? existing.advancingPerMatch : 1;
    let bracket = existing ? existing.bracket : buildBracket(N, M, A);
    let generated = !!existing;

    const nInput = document.getElementById('tm-n-input');

    function updateAOptions() {
      const aSel = document.getElementById('tm-a-sel');
      if (!aSel) return;
      const cur = parseInt(aSel.value) || 1;
      aSel.innerHTML = Array.from({ length: M - 1 }, (_, i) => i + 1)
        .map(v => `<option value="${v}" ${v === Math.min(cur, M - 1) ? 'selected' : ''}>${v}명</option>`)
        .join('');
      A = Math.min(cur, M - 1);
    }

    function getRoundLabel(ri, total) {
      if (ri === total - 1) return '🏆 결승';
      if (ri === total - 2 && total > 2) return '준결승';
      return `${ri + 1}라운드`;
    }

    function getOptimalSizes() {
      const areaW = bracketArea.clientWidth - 48;
      const areaH = bracketArea.clientHeight - 48;
      const numRounds = bracket.length;
      const connW = 44;
      const totalConnW = (numRounds - 1) * connW;
      const colW = Math.max(100, Math.floor((areaW - totalConnW) / numRounds));
      const maxMatches = Math.max(...bracket.map(r => r.length));
      const matchH = Math.max(M * 28 + 8, Math.floor((areaH - 40) / maxMatches - 10));
      return { colW, matchH };
    }

    function renderBracket(animateAfter = false) {
      bracketEl.innerHTML = '';
      if (!generated && !animateAfter) {
        bracketEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;min-width:320px;color:#b08060;font-family:var(--font-body);font-size:1rem;text-align:center;">"대진표 작성하기" 버튼을 눌러주세요.</div>`;
        return;
      }

      // Current match position (from saved data when tournament is active)
      const saved = load();
      const curR = (saved?.active && saved.currentRound != null) ? saved.currentRound : -1;
      const curM = (saved?.active && saved.currentMatch != null) ? saved.currentMatch : -1;

      // Update header status
      const statusEl = document.getElementById('tm-status');
      if (statusEl) {
        if (curR >= 0 && curR < bracket.length) {
          const label = getRoundLabel(curR, bracket.length);
          statusEl.textContent = `▶ ${label} ${curM + 1}경기 진행 중`;
          statusEl.style.display = '';
        } else if (saved && !saved.active && generated) {
          statusEl.textContent = '🏆 토너먼트 종료';
          statusEl.style.display = '';
        } else {
          statusEl.style.display = 'none';
        }
      }

      const totalRounds = bracket.length;
      const roundEls = [];
      const connEls = [];
      const { colW, matchH } = getOptimalSizes();

      bracket.forEach((round, ri) => {
        const col = document.createElement('div');
        col.style.cssText = `display:flex;flex-direction:column;flex-shrink:0;width:${colW}px;`;

        const roundLabel = document.createElement('div');
        roundLabel.style.cssText = `font-family:var(--font-body);font-size:0.72rem;font-weight:800;color:#b08060;text-align:center;letter-spacing:0.04em;padding:0 0 0.5rem 0;flex-shrink:0;`;
        roundLabel.textContent = getRoundLabel(ri, totalRounds);
        col.appendChild(roundLabel);

        const matchesWrap = document.createElement('div');
        matchesWrap.style.cssText = `display:flex;flex-direction:column;justify-content:space-around;flex:1;`;

        round.forEach((match, mi) => {
          const isCurrent = ri === curR && mi === curM;
          const isPast = ri < curR || (ri === curR && mi < curM);

          const wrap = document.createElement('div');
          wrap.style.cssText = `flex:1;display:flex;flex-direction:column;justify-content:center;min-height:${matchH}px;`;

          const matchEl = document.createElement('div');
          matchEl.className = 'tm-match';
          matchEl.style.cssText = `
            background:${isCurrent ? '#fff8e7' : isPast ? '#f5f5f5' : '#fff'};
            border:${isCurrent ? '2px solid #ff8c42' : '1.5px solid rgba(200,160,110,0.35)'};
            border-radius:0.6rem;overflow:hidden;margin:3px 0;
            box-shadow:${isCurrent ? '0 0 0 3px rgba(255,140,66,0.2), 0 2px 8px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)'};
          `;
          if (isCurrent) {
            const badge = document.createElement('div');
            badge.style.cssText = 'background:#ff8c42;color:#fff;font-family:var(--font-body);font-size:0.65rem;font-weight:800;padding:2px 6px;text-align:center;letter-spacing:0.04em;';
            badge.textContent = '▶ 현재 경기';
            matchEl.appendChild(badge);
          }

          const slotsData = ri === 0 ? match.players : new Array(M).fill(null);
          slotsData.forEach((player, si) => {
            const slot = document.createElement('div');
            slot.className = 'tm-slot';
            slot.style.cssText = `
              padding:0.28rem 0.5rem;
              font-family:var(--font-display);font-size:0.82rem;
              color:${(!animateAfter && player) ? '#2c1a0e' : '#c8a06e'};
              font-weight:${(!animateAfter && player) ? '800' : '400'};
              background:${si % 2 === 0 ? 'rgba(200,160,110,0.05)' : '#fff'};
              border-top:${si > 0 ? '1px solid rgba(200,160,110,0.15)' : 'none'};
              min-height:26px;display:flex;align-items:center;
              transition:transform 0.2s;
            `;
            // When animating, show "—" initially; otherwise show real value
            slot.textContent = ri === 0
              ? (animateAfter ? '—' : (player ? `${player}번` : '—'))
              : '?';
            matchEl.appendChild(slot);
          });

          wrap.appendChild(matchEl);
          matchesWrap.appendChild(wrap);
        });

        col.appendChild(matchesWrap);
        bracketEl.appendChild(col);
        roundEls.push(col);

        if (ri < totalRounds - 1) {
          const conn = document.createElement('div');
          conn.style.cssText = `width:${44}px;flex-shrink:0;position:relative;align-self:stretch;`;
          bracketEl.appendChild(conn);
          connEls.push(conn);
        }
      });

      // Draw SVG lines after layout
      requestAnimationFrame(() => requestAnimationFrame(() => {
        drawConnectors(bracket, roundEls, connEls);
        if (animateAfter) animateAssignments(bracket, roundEls, N);
      }));
    }

    // Event wiring
    function syncN(val) {
      N = Math.max(2, Math.min(64, parseInt(val) || 2));
      nInput.value = N;
      generated = false;
      renderBracket();
    }
    document.getElementById('tm-n-dec').addEventListener('click', () => syncN(N - 1));
    document.getElementById('tm-n-inc').addEventListener('click', () => syncN(N + 1));
    nInput.addEventListener('input', () => syncN(nInput.value));
    nInput.addEventListener('change', () => syncN(nInput.value));

    document.getElementById('tm-m-sel').addEventListener('change', e => {
      M = parseInt(e.target.value); updateAOptions(); generated = false; renderBracket();
    });
    document.getElementById('tm-a-sel').addEventListener('change', e => { A = parseInt(e.target.value); });

    document.getElementById('tm-generate-btn').addEventListener('click', () => {
      A = parseInt(document.getElementById('tm-a-sel').value) || 1;
      bracket = buildBracket(N, M, A);
      assignParticipants(bracket, N, M);
      generated = true;
      renderBracket(true); // animate
    });

    document.getElementById('tm-apply-btn').addEventListener('click', () => {
      if (!generated) { alert('먼저 대진표를 작성해주세요!'); return; }
      save({ totalPlayers: N, playersPerMatch: M, advancingPerMatch: A, bracket, active: true, currentRound: 0, currentMatch: 0 });
      updateTournamentBtn(true);
      overlay.remove();
    });

    document.getElementById('tm-clear-btn').addEventListener('click', () => {
      clear(); updateTournamentBtn(false);
      generated = false; bracket = buildBracket(N, M, A); renderBracket();
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

    getCurrentMatchInfo() {
      const d = load();
      if (!d || !d.active || !d.bracket) return null;
      const round = d.currentRound || 0;
      const match = d.currentMatch || 0;
      const roundArr = d.bracket[round];
      if (!roundArr) return null;
      const matchObj = roundArr[match];
      if (!matchObj) return null;
      return {
        players: matchObj.players.filter(p => p !== null),
        round,
        match,
        totalRounds: d.bracket.length,
        totalMatchesInRound: roundArr.length
      };
    },

    advanceMatch() {
      const d = load();
      if (!d) return;
      let round = d.currentRound || 0;
      let match = (d.currentMatch || 0) + 1;
      if (match >= (d.bracket[round] || []).length) { round++; match = 0; }
      if (round >= d.bracket.length) { d.active = false; updateTournamentBtn(false); }
      d.currentRound = round; d.currentMatch = match;
      save(d);
    },

    init() {
      if (this.isActive()) updateTournamentBtn(true);
    }
  };
})();
