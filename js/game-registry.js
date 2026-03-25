/**
 * game-registry.js
 * Catalog of all available games.
 * Each entry describes a game that can be loaded into a player panel.
 *
 * Fields:
 *   id          — unique kebab-case identifier, matches the folder name in /games/
 *   name        — display name (Korean)
 *   icon        — emoji icon
 *   description — short description shown on the game select card (Korean)
 *   color       — primary accent color for this game's card
 *   isNew       — shows a "NEW" sticker badge
 *   isHot       — shows a "HOT" sticker badge
 *   available   — false = locked/placeholder (greyed out)
 *   entryFile   — relative path to the game's JS module from /games/
 */

const GAMES = [
  {
    id:          'missing-number',
    name:        '빠진 수 찾기',
    icon:        '🔢',
    description: '수열에서 빠진 숫자를 찾아요! 1→2→?→4 어떤 수일까요?',
    color:       '#f59e0b',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'missing-number/game.js',
  },
  {
    id:          'infinite-stairs',
    name:        '무한의 계단',
    icon:        '🪜',
    description: '좌/우 버튼으로 계단을 올라가요! 틀리거나 시간 초과면 끝!',
    color:       '#7ed3ff',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'infinite-stairs/game.js',
  },
  {
    id:          'reaction-speed',
    name:        '반응속도',
    icon:        '⚡',
    description: '초록불이 켜지는 순간 탭! 반응속도를 측정해요!',
    color:       '#4ade80',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'reaction-speed/game.js',
  },
  {
    id:          'perfect-circle',
    name:        '완벽한 원',
    icon:        '⭕',
    description: '손가락으로 완벽한 원을 그려봐요! 원형도로 점수 계산!',
    color:       '#7ed3ff',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'perfect-circle/game.js',
  },
  {
    id:          'drawing-game',
    name:        '빨리 그리기',
    icon:        '✏️',
    description: '제시어를 그리면 AI가 맞혀요! 먼저 맞추면 승리!',
    color:       '#f59e0b',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'drawing-game/game.js',
  },
  {
    id:          'time-master',
    name:        '시간 지배자',
    icon:        '⏱️',
    description: '목표 시간에 딱 맞게 [지금!]을 눌러요! 오차가 작을수록 고득점!',
    color:       '#f59e0b',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'time-master/game.js',
  },
  {
    id:          'number-pop',
    name:        '숫자 팡팡',
    icon:        '🔢',
    description: '올바른 숫자 버블을 터치해요!',
    color:       '#fdd34d',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'number-pop/game.js',
  },
  {
    id:          'times-quiz',
    name:        '구구단 배틀',
    icon:        '✖️',
    description: '선착순! 구구단 문제를 먼저 맞혀요 2단~9단',
    color:       '#f9a825',
    isNew:       true,
    isHot:       true,
    isQuiz:      true,
    available:   true,
    entryFile:   'times-quiz/game.js',
  },
  {
    id:          'color-match',
    name:        '색깔 맞추기',
    icon:        '🎨',
    description: '글자의 잉크 색상을 맞춰봐요! Stroop 효과 집중력 게임!',
    color:       '#fd8863',
    isNew:       false,
    isHot:       true,
    available:   true,
    entryFile:   'color-match/game.js',
  },
  {
    id:          'word-quiz',
    name:        '낱말 퀴즈',
    icon:        '📝',
    description: '빠진 글자를 맞춰봐요! 한국어 낱말 퀴즈!',
    color:       '#c084fc',
    isNew:       false,
    isHot:       false,
    available:   true,
    entryFile:   'word-quiz/game.js',
  },
  {
    id:          'number-bomb',
    name:        '숫자 폭탄',
    icon:        '💥',
    description: '합이 목표가 되는 두 숫자를 빠르게 탭해요!',
    color:       '#ff5722',
    isNew:       true,
    isHot:       true,
    available:   true,
    entryFile:   'number-bomb/game.js',
  },
  {
    id:          'quiz-flags',
    name:        '국기 퀴즈',
    icon:        '🌍',
    description: '선착순! 국기를 보고 나라 이름을 맞혀요',
    color:       '#3949ab',
    isNew:       true,
    isHot:       true,
    isQuiz:      true,
    available:   true,
    entryFile:   'quiz-flags/game.js',
  },
  {
    id:          'quiz-words',
    name:        '영어 단어 퀴즈',
    icon:        '🔤',
    description: '선착순! 한국어를 보고 영어 단어를 맞혀요',
    color:       '#00897b',
    isNew:       true,
    isHot:       false,
    isQuiz:      true,
    available:   true,
    entryFile:   'quiz-words/game.js',
  },
  {
    id:          'math-race',
    name:        '수학 레이스',
    icon:        '🏎️',
    description: '빠른 계산으로 로켓을 결승선까지 달려요!',
    color:       '#7ed3ff',
    isNew:       false,
    isHot:       false,
    available:   true,
    entryFile:   'math-race/game.js',
  },
  {
    id:          'number-hunt',
    name:        '숫자 빨리 찾기',
    icon:        '🔍',
    description: '숫자를 순서대로 빠르게 찾아요!',
    color:       '#ff9800',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'number-hunt/game.js',
    difficulties: [
      { id: 'easy',   label: '쉬움',   sub: '5×5 (25개)', size: 5 },
      { id: 'medium', label: '보통',   sub: '6×6 (36개)', size: 6 },
      { id: 'hard',   label: '어려움', sub: '7×7 (49개)', size: 7 },
    ],
  },
  {
    id:          'number-slide',
    name:        '넘버 슬라이드',
    icon:        '🔢',
    description: '4개 숫자로 목표 숫자를 만들어요! (24게임)',
    color:       '#1565c0',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'number-slide/game.js',
  },
  {
    id:          'memory-flip',
    name:        '기억 카드',
    icon:        '🃏',
    description: '카드를 뒤집어 같은 그림 짝을 찾아요!',
    color:       '#4ade80',
    isNew:       false,
    isHot:       false,
    available:   true,
    entryFile:   'memory-flip/game.js',
  },
  {
    id:          'rhythm-tap',
    name:        '리듬 탭',
    icon:        '🥁',
    description: '떨어지는 원을 타이밍 맞춰 탭해요!',
    color:       '#f472b6',
    isNew:       false,
    isHot:       false,
    available:   true,
    entryFile:   'rhythm-tap/game.js',
  },
  {
    id:          'tetris',
    name:        '테트리스',
    icon:        '🟦',
    description: '블록을 쌓아 줄을 없애요!',
    color:       '#00bcd4',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'tetris/game.js',
  },
  {
    id:          'breakout',
    name:        '블록 깨기',
    icon:        '🧱',
    description: '공을 튕겨 블록을 전부 깨요!',
    color:       '#e53935',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'breakout/game.js',
  },
  {
    id:          'snake',
    name:        '뱀 게임',
    icon:        '🐍',
    description: '먹이를 먹을수록 뱀이 길어져요!',
    color:       '#43a047',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'snake/game.js',
  },
  {
    id:          'minesweeper',
    name:        '지뢰찾기',
    icon:        '💣',
    description: '지뢰를 피해 모든 칸을 열어요!',
    color:       '#78909c',
    isNew:       true,
    isHot:       false,
    available:   true,
    entryFile:   'minesweeper/game.js',
    difficulties: [
      { id: 'easy',   label: '쉬움',   sub: '9×9, 지뢰 10개',   rows: 9,  cols: 9,  mines: 10 },
      { id: 'medium', label: '보통',   sub: '12×12, 지뢰 20개', rows: 12, cols: 12, mines: 20 },
      { id: 'hard',   label: '어려움', sub: '16×16, 지뢰 40개', rows: 16, cols: 16, mines: 40 },
    ],
  },
];

/**
 * Look up a game entry by its id.
 * @param {string} id
 * @returns {object|undefined}
 */
function getGameById(id) {
  return GAMES.find(g => g.id === id);
}

/**
 * Return only games that are available (not locked).
 * @returns {object[]}
 */
function getAvailableGames() {
  return GAMES.filter(g => g.available);
}

// Make accessible globally (no module bundler in use)
window.GAMES        = GAMES;
window.getGameById  = getGameById;
window.getAvailableGames = getAvailableGames;
