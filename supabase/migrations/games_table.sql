-- games table: single source of truth for the game catalog
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.games (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL DEFAULT '🎮',
  description  TEXT NOT NULL DEFAULT '',
  color        TEXT NOT NULL DEFAULT '#f59e0b',
  color_name   TEXT NOT NULL DEFAULT 'amber',
  category     TEXT NOT NULL DEFAULT '기타',
  is_new       BOOLEAN NOT NULL DEFAULT FALSE,
  is_hot       BOOLEAN NOT NULL DEFAULT FALSE,
  is_quiz      BOOLEAN NOT NULL DEFAULT FALSE,
  available    BOOLEAN NOT NULL DEFAULT TRUE,
  entry_file   TEXT NOT NULL,
  difficulties JSONB,
  display_order INTEGER NOT NULL DEFAULT 99
);

-- Enable row-level security (read-only for anon)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "games_public_read" ON public.games;
CREATE POLICY "games_public_read" ON public.games
  FOR SELECT USING (TRUE);

-- Seed data
INSERT INTO public.games (id, name, icon, description, color, color_name, category, is_new, is_hot, is_quiz, available, entry_file, difficulties, display_order)
VALUES
  ('missing-number',  '빠진 수 찾기',  '🔢', '수열에서 빠진 숫자를 찾아요! 1→2→?→4 어떤 수일까요?',     '#f59e0b', 'amber',  '수학',   TRUE,  TRUE,  FALSE, TRUE, 'missing-number/game.js',  NULL, 1),
  ('infinite-stairs', '무한의 계단',   '🪜', '좌/우 버튼으로 계단을 올라가요! 틀리거나 시간 초과면 끝!', '#7ed3ff', 'blue',   '아케이드', TRUE,  TRUE,  FALSE, TRUE, 'infinite-stairs/game.js', NULL, 2),
  ('reaction-speed',  '반응속도',      '⚡', '초록불이 켜지는 순간 탭! 반응속도를 측정해요!',            '#4ade80', 'green',  '감각',   TRUE,  TRUE,  FALSE, TRUE, 'reaction-speed/game.js',  NULL, 3),
  ('perfect-circle',  '완벽한 원',     '⭕', '손가락으로 완벽한 원을 그려봐요! 원형도로 점수 계산!',      '#7ed3ff', 'blue',   '감각',   TRUE,  TRUE,  FALSE, TRUE, 'perfect-circle/game.js',  NULL, 4),
  ('drawing-game',    '빨리 그리기',   '✏️', '제시어를 그리면 AI가 맞혀요! 먼저 맞추면 승리!',           '#f59e0b', 'amber',  '창의',   TRUE,  TRUE,  FALSE, TRUE, 'drawing-game/game.js',    NULL, 5),
  ('time-master',     '시간 지배자',   '⏱️', '목표 시간에 딱 맞게 [지금!]을 눌러요! 오차가 작을수록 고득점!', '#f59e0b', 'blue', '감각',   TRUE,  TRUE,  FALSE, TRUE, 'time-master/game.js',     NULL, 6),
  ('number-pop',      '숫자 팡팡',     '🔢', '올바른 숫자 버블을 터치해요!',                             '#fdd34d', 'yellow', '수학',   TRUE,  FALSE, FALSE, TRUE, 'number-pop/game.js',      NULL, 7),
  ('times-quiz',      '구구단 배틀',   '✖️', '선착순! 구구단 문제를 먼저 맞혀요 2단~9단',                '#f9a825', 'yellow', '퀴즈',   TRUE,  TRUE,  TRUE,  TRUE, 'times-quiz/game.js',      NULL, 8),
  ('color-match',     '잉크 색깔',     '🎨', '글자의 잉크 색상을 맞춰요! 단어 뜻에 속으면 안 돼요 — Stroop 집중력 게임!', '#fd8863', 'orange', '집중력', FALSE, TRUE, FALSE, TRUE, 'color-match/game.js', NULL, 9),
  ('color-stack',     '색깔 블럭',     '🟥', '빨강·파랑·초록 나무블럭! 맨 아래 블럭 색깔 버튼을 눌러 하나씩 지워봐요!', '#ff5252', 'red', '집중력', TRUE, TRUE, FALSE, TRUE, 'color-stack/game.js', NULL, 10),
  ('word-quiz',       '낱말 퀴즈',     '📝', '빠진 글자를 맞춰봐요! 한국어 낱말 퀴즈!',                   '#c084fc', 'purple', '언어',   FALSE, FALSE, FALSE, TRUE, 'word-quiz/game.js',       NULL, 11),
  ('number-bomb',     '숫자 폭탄',     '💥', '합이 목표가 되는 두 숫자를 빠르게 탭해요!',                 '#ff5722', 'fire',   '수학',   TRUE,  TRUE,  FALSE, TRUE, 'number-bomb/game.js',     NULL, 12),
  ('quiz-flags',      '국기 퀴즈',     '🌍', '선착순! 국기를 보고 나라 이름을 맞혀요',                    '#3949ab', 'indigo', '퀴즈',   TRUE,  TRUE,  TRUE,  TRUE, 'quiz-flags/game.js',      NULL, 13),
  ('quiz-words',      '영어 단어 퀴즈','🔤', '선착순! 한국어를 보고 영어 단어를 맞혀요',                  '#00897b', 'teal',   '퀴즈',   TRUE,  FALSE, TRUE,  TRUE, 'quiz-words/game.js',      NULL, 14),
  ('math-race',       '수학 레이스',   '🏎️', '빠른 계산으로 로켓을 결승선까지 달려요!',                   '#7ed3ff', 'blue',   '계산',   FALSE, FALSE, FALSE, TRUE, 'math-race/game.js',       NULL, 15),
  ('number-hunt',     '숫자 빨리 찾기','🔍', '숫자를 순서대로 빠르게 찾아요!',                            '#ff9800', 'amber',  '집중력', TRUE,  FALSE, FALSE, TRUE, 'number-hunt/game.js',
    '[{"id":"easy","label":"쉬움","sub":"5×5 (25개)","size":5},{"id":"medium","label":"보통","sub":"6×6 (36개)","size":6},{"id":"hard","label":"어려움","sub":"7×7 (49개)","size":7}]', 16),
  ('number-slide',    '넘버 슬라이드', '🔢', '4개 숫자로 목표 숫자를 만들어요! (24게임)',                  '#1565c0', 'navy',   '수학',   TRUE,  FALSE, FALSE, TRUE, 'number-slide/game.js',    NULL, 17),
  ('memory-flip',     '기억 카드',     '🃏', '카드를 뒤집어 같은 그림 짝을 찾아요!',                      '#4ade80', 'green',  '기억력', FALSE, FALSE, FALSE, TRUE, 'memory-flip/game.js',     NULL, 18),
  ('rhythm-tap',      '리듬 탭',       '🥁', '떨어지는 원을 타이밍 맞춰 탭해요!',                         '#f472b6', 'pink',   '음악',   FALSE, FALSE, FALSE, TRUE, 'rhythm-tap/game.js',      NULL, 19),
  ('tetris',          '테트리스',      '🟦', '블록을 쌓아 줄을 없애요!',                                  '#00bcd4', 'cyan',   '전략',   TRUE,  FALSE, FALSE, TRUE, 'tetris/game.js',          NULL, 20),
  ('breakout',        '블록 깨기',     '🧱', '공을 튕겨 블록을 전부 깨요!',                               '#e53935', 'red',    '아케이드', TRUE, FALSE, FALSE, TRUE, 'breakout/game.js',       NULL, 21),
  ('snake',           '뱀 게임',       '🐍', '먹이를 먹을수록 뱀이 길어져요!',                             '#43a047', 'grass',  '아케이드', TRUE, FALSE, FALSE, TRUE, 'snake/game.js',          NULL, 22),
  ('gomoku',          '오목',          '⚫', '다같이 두는 오목! 1·2·4인 지원, 5목을 먼저 완성하세요!',    '#dcb483', 'amber',  '전략',   TRUE,  TRUE,  FALSE, TRUE, 'gomoku/game.js',          NULL, 23),
  ('minesweeper',     '지뢰찾기',      '💣', '지뢰를 피해 모든 칸을 열어요!',                             '#78909c', 'slate',  '추리',   TRUE,  FALSE, FALSE, TRUE, 'minesweeper/game.js',
    '[{"id":"easy","label":"쉬움","sub":"9×9, 지뢰 10개","rows":9,"cols":9,"mines":10},{"id":"medium","label":"보통","sub":"12×12, 지뢰 20개","rows":12,"cols":12,"mines":20},{"id":"hard","label":"어려움","sub":"16×16, 지뢰 40개","rows":16,"cols":16,"mines":40}]', 24)
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  icon         = EXCLUDED.icon,
  description  = EXCLUDED.description,
  color        = EXCLUDED.color,
  color_name   = EXCLUDED.color_name,
  category     = EXCLUDED.category,
  is_new       = EXCLUDED.is_new,
  is_hot       = EXCLUDED.is_hot,
  is_quiz      = EXCLUDED.is_quiz,
  available    = EXCLUDED.available,
  entry_file   = EXCLUDED.entry_file,
  difficulties = EXCLUDED.difficulties,
  display_order = EXCLUDED.display_order;
