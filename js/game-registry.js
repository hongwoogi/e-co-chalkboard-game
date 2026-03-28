/**
 * game-registry.js
 * Catalog of all available games.
 *
 * Source of truth: Supabase `games` table.
 * Fallback: hardcoded GAMES_FALLBACK array (keeps the app working offline).
 *
 * On load, immediately populates window.GAMES from fallback, then fetches
 * from DB. When DB data arrives, updates window.GAMES and dispatches
 * a 'gamesUpdated' CustomEvent so the UI can re-render the card grid.
 */

const GAMES_FALLBACK = [
  { id:'missing-number',  name:'빠진 수 찾기',  icon:'🔢', description:'수열에서 빠진 숫자를 찾아요! 1→2→?→4 어떤 수일까요?',     color:'#f59e0b', colorName:'amber',  category:'수학',    isNew:true,  isHot:true,  available:true, entryFile:'missing-number/game.js' },
  { id:'infinite-stairs', name:'무한의 계단',   icon:'🪜', description:'좌/우 버튼으로 계단을 올라가요! 틀리거나 시간 초과면 끝!', color:'#7ed3ff', colorName:'blue',   category:'아케이드', isNew:true,  isHot:true,  available:true, entryFile:'infinite-stairs/game.js' },
  { id:'reaction-speed',  name:'반응속도',      icon:'⚡', description:'초록불이 켜지는 순간 탭! 반응속도를 측정해요!',            color:'#4ade80', colorName:'green',  category:'감각',    isNew:true,  isHot:true,  available:true, entryFile:'reaction-speed/game.js' },
  { id:'perfect-circle',  name:'완벽한 원',     icon:'⭕', description:'손가락으로 완벽한 원을 그려봐요! 원형도로 점수 계산!',      color:'#7ed3ff', colorName:'blue',   category:'감각',    isNew:true,  isHot:true,  available:true, entryFile:'perfect-circle/game.js' },
  { id:'drawing-game',    name:'빨리 그리기',   icon:'✏️', description:'제시어를 그리면 AI가 맞혀요! 먼저 맞추면 승리!',           color:'#f59e0b', colorName:'amber',  category:'창의',    isNew:true,  isHot:true,  available:true, entryFile:'drawing-game/game.js' },
  { id:'time-master',     name:'시간 지배자',   icon:'⏱️', description:'목표 시간에 딱 맞게 [지금!]을 눌러요! 오차가 작을수록 고득점!', color:'#f59e0b', colorName:'blue', category:'감각', isNew:true, isHot:true, available:true, entryFile:'time-master/game.js' },
  { id:'number-pop',      name:'숫자 팡팡',     icon:'🔢', description:'올바른 숫자 버블을 터치해요!',                             color:'#fdd34d', colorName:'yellow', category:'수학',    isNew:true,  isHot:false, available:true, entryFile:'number-pop/game.js' },
  { id:'times-quiz',      name:'구구단 배틀',   icon:'✖️', description:'선착순! 구구단 문제를 먼저 맞혀요 2단~9단',                color:'#f9a825', colorName:'yellow', category:'퀴즈',    isNew:true,  isHot:true,  isQuiz:true, available:true, entryFile:'times-quiz/game.js' },
  { id:'color-match',     name:'잉크 색깔',     icon:'🎨', description:'글자의 잉크 색상을 맞춰요! 단어 뜻에 속으면 안 돼요 — Stroop 집중력 게임!', color:'#fd8863', colorName:'orange', category:'집중력', isNew:false, isHot:true, available:true, entryFile:'color-match/game.js' },
  { id:'color-stack',     name:'색깔 블럭',     icon:'🟥', description:'빨강·파랑·초록 나무블럭! 맨 아래 블럭 색깔 버튼을 눌러 하나씩 지워봐요!', color:'#ff5252', colorName:'red', category:'집중력', isNew:true, isHot:true, available:true, entryFile:'color-stack/game.js' },
  { id:'word-quiz',       name:'낱말 퀴즈',     icon:'📝', description:'빠진 글자를 맞춰봐요! 한국어 낱말 퀴즈!',                   color:'#c084fc', colorName:'purple', category:'언어',    isNew:false, isHot:false, available:true, entryFile:'word-quiz/game.js' },
  { id:'number-bomb',     name:'숫자 폭탄',     icon:'💥', description:'합이 목표가 되는 두 숫자를 빠르게 탭해요!',                 color:'#ff5722', colorName:'fire',   category:'수학',    isNew:true,  isHot:true,  available:true, entryFile:'number-bomb/game.js' },
  { id:'quiz-flags',      name:'국기 퀴즈',     icon:'🌍', description:'선착순! 국기를 보고 나라 이름을 맞혀요',                    color:'#3949ab', colorName:'indigo', category:'퀴즈',    isNew:true,  isHot:true,  isQuiz:true, available:true, entryFile:'quiz-flags/game.js' },
  { id:'quiz-words',      name:'영어 단어 퀴즈',icon:'🔤', description:'선착순! 한국어를 보고 영어 단어를 맞혀요',                  color:'#00897b', colorName:'teal',   category:'퀴즈',    isNew:true,  isHot:false, isQuiz:true, available:true, entryFile:'quiz-words/game.js' },
  { id:'math-race',       name:'수학 레이스',   icon:'🏎️', description:'빠른 계산으로 로켓을 결승선까지 달려요!',                   color:'#7ed3ff', colorName:'blue',   category:'계산',    isNew:false, isHot:false, available:true, entryFile:'math-race/game.js' },
  { id:'number-hunt',     name:'숫자 빨리 찾기',icon:'🔍', description:'숫자를 순서대로 빠르게 찾아요!',                            color:'#ff9800', colorName:'amber',  category:'집중력',  isNew:true,  isHot:false, available:true, entryFile:'number-hunt/game.js',
    difficulties:[{id:'easy',label:'쉬움',sub:'5×5 (25개)',size:5},{id:'medium',label:'보통',sub:'6×6 (36개)',size:6},{id:'hard',label:'어려움',sub:'7×7 (49개)',size:7}] },
  { id:'number-slide',    name:'넘버 슬라이드', icon:'🔢', description:'4개 숫자로 목표 숫자를 만들어요! (24게임)',                  color:'#1565c0', colorName:'navy',   category:'수학',    isNew:true,  isHot:false, available:true, entryFile:'number-slide/game.js' },
  { id:'memory-flip',     name:'기억 카드',     icon:'🃏', description:'카드를 뒤집어 같은 그림 짝을 찾아요!',                      color:'#4ade80', colorName:'green',  category:'기억력',  isNew:false, isHot:false, available:true, entryFile:'memory-flip/game.js' },
  { id:'rhythm-tap',      name:'리듬 탭',       icon:'🥁', description:'떨어지는 원을 타이밍 맞춰 탭해요!',                         color:'#f472b6', colorName:'pink',   category:'음악',    isNew:false, isHot:false, available:true, entryFile:'rhythm-tap/game.js' },
  { id:'tetris',          name:'테트리스',      icon:'🟦', description:'블록을 쌓아 줄을 없애요!',                                  color:'#00bcd4', colorName:'cyan',   category:'전략',    isNew:true,  isHot:false, available:true, entryFile:'tetris/game.js' },
  { id:'breakout',        name:'블록 깨기',     icon:'🧱', description:'공을 튕겨 블록을 전부 깨요!',                               color:'#e53935', colorName:'red',    category:'아케이드', isNew:true,  isHot:false, available:true, entryFile:'breakout/game.js' },
  { id:'snake',           name:'뱀 게임',       icon:'🐍', description:'먹이를 먹을수록 뱀이 길어져요!',                             color:'#43a047', colorName:'grass',  category:'아케이드', isNew:true,  isHot:false, available:true, entryFile:'snake/game.js' },
  { id:'gomoku',          name:'오목',          icon:'⚫', description:'다같이 두는 오목! 1·2·4인 지원, 5목을 먼저 완성하세요!',    color:'#dcb483', colorName:'amber',  category:'전략',    isNew:true,  isHot:true,  available:true, entryFile:'gomoku/game.js' },
  { id:'minesweeper',     name:'지뢰찾기',      icon:'💣', description:'지뢰를 피해 모든 칸을 열어요!',                             color:'#78909c', colorName:'slate',  category:'추리',    isNew:true,  isHot:false, available:true, entryFile:'minesweeper/game.js',
    difficulties:[{id:'easy',label:'쉬움',sub:'9×9, 지뢰 10개',rows:9,cols:9,mines:10},{id:'medium',label:'보통',sub:'12×12, 지뢰 20개',rows:12,cols:12,mines:20},{id:'hard',label:'어려움',sub:'16×16, 지뢰 40개',rows:16,cols:16,mines:40}] },
];

/* Normalise a raw DB row (snake_case) → app object (camelCase) */
function normaliseRow(r) {
  return {
    id:          r.id,
    name:        r.name,
    icon:        r.icon,
    description: r.description,
    color:       r.color,
    colorName:   r.color_name,
    category:    r.category,
    isNew:       r.is_new,
    isHot:       r.is_hot,
    isQuiz:      r.is_quiz,
    available:   r.available,
    entryFile:   r.entry_file,
    difficulties: r.difficulties || undefined,
  };
}

/* Immediately expose fallback so the rest of the app works synchronously */
let GAMES = GAMES_FALLBACK.slice();
window.GAMES = GAMES;

function getGameById(id)      { return GAMES.find(g => g.id === id); }
function getAvailableGames()  { return GAMES.filter(g => g.available); }

window.getGameById       = getGameById;
window.getAvailableGames = getAvailableGames;

/* Fetch from Supabase and refresh — fires 'gamesUpdated' when done */
(async function loadGamesFromDB() {
  const SUPA_URL  = '/sb';
  const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc0MzU2MTcyLCJleHAiOjE5MzIwMzYxNzJ9.Tte-16sqvVngAJTLJT7o2XNKV4b_WGAhaVtFf7Iy5dY';

  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/games?available=eq.true&order=display_order`,
      { headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${SUPA_ANON}` } }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;

    GAMES = rows.map(normaliseRow);
    window.GAMES = GAMES;
    window.dispatchEvent(new CustomEvent('gamesUpdated'));
  } catch (_) { /* network error — keep fallback */ }
})();
