# 칠판 게임 디자인 시스템

> 이 문서는 프로젝트 전체에 일관되게 적용되는 디자인 원칙, 토큰, 컴포넌트를 정리합니다.

---

## 1. 디자인 원칙

| 원칙 | 설명 |
|------|------|
| **Flat 2D** | 그라데이션 없음. 단색 + 굵은 테두리 + 하드 오프셋 그림자만 사용 |
| **베이지 배경** | 모든 게임 컨테이너 배경은 `#f7f3ee` (warm beige) |
| **플레이어 색상 우선** | UI 강조색은 항상 `playerColor` (CSS 변수 `--panel-color`) 기반 |
| **파스텔 혼합** | 버튼/셀 배경 = `color-mix(in srgb, playerColor N%, #f0ece5)` |
| **모바일 우선** | 터치 타겟 최소 44px, `env(safe-area-inset-bottom)` 적용 |

---

## 2. 색상 토큰 (`css/design-system.css`)

### 서피스 스케일 (어두운 → 밝음)
```
--background:                #0c0e10
--surface-container-lowest:  #000000
--surface-container-low:     #111416
--surface-container:         #171a1c
--surface-container-high:    #1d2022
--surface-container-highest: #232629
--surface-variant:           #3a3d40
--outline-variant:           #46484a
```

### 텍스트
```
--on-surface:         #eeeef0  (기본 텍스트)
--on-surface-variant: #aaabad  (보조 텍스트)
```

### 브랜드 컬러
```
--primary:           #fdd34d  (골든 옐로우)
--primary-container: #c19c13  (딥 골드)
--secondary:         #fd8863  (코랄 오렌지)
--tertiary:          #7ed3ff  (스카이 블루)
```

### 플레이어 컬러
| 플레이어 | 변수 | 색상 |
|---------|------|------|
| P1 | `--color-player-1` | `#7ed3ff` (스카이 블루) |
| P2 | `--color-player-2` | `#fd8863` (코랄 오렌지) |
| P3 | `--color-player-3` | `#fdd34d` (옐로우) |
| P4 | `--color-player-4` | `#c084fc` (퍼플) |

### 시맨틱 컬러
```
--color-correct: #4ade80  (정답 — 초록)
--color-wrong:   #f87171  (오답 — 빨강)
```

### 홈 화면 전용 색상
```
배경:        #fdf6ed  (warm beige)
사이드바:    #fff8ef
텍스트:      #3d2b1f  (다크 브라운)
강조:        #e8630a  (딥 오렌지 — 로고 포인트)
보조 텍스트: #b08060  (미디엄 브라운)
```

---

## 3. 타이포그래피

### 폰트 패밀리
| 변수 | 폰트 | 용도 |
|------|------|------|
| `--font-display` | KccSign (KCC 칸판체) | 점수, 제목, 버튼 레이블 |
| `--font-body` | OmuDaye (omyu_pretty) | 설명, 안내문, 작은 텍스트 |

> 폰트 출처: [noonfonts CDN](https://cdn.jsdelivr.net/gh/projectnoonnu/)

### 폰트 크기 (반응형 clamp)
| 변수 | 최솟값 | 기준 | 최댓값 |
|------|--------|------|--------|
| `--text-xs` | 0.65rem | 1.2vw | 0.8rem |
| `--text-sm` | 0.8rem | 1.5vw | 1rem |
| `--text-md` | 1rem | 2vw | 1.25rem |
| `--text-lg` | 1.25rem | 2.5vw | 1.75rem |
| `--text-xl` | 1.75rem | 3.5vw | 2.5rem |
| `--text-2xl` | 2.5rem | 5vw | 4rem |
| `--text-3xl` | 3.5rem | 7vw | 6rem |

---

## 4. 간격 (Spacing)

```
--space-xs:  0.25rem   ( 4px)
--space-sm:  0.5rem    ( 8px)
--space-md:  1rem      (16px)
--space-lg:  1.5rem    (24px)
--space-xl:  2rem      (32px)
--space-2xl: 3rem      (48px)
```

---

## 5. 보더 라디우스

```
--radius-sm:   0.5rem    ( 8px)
--radius-md:   1rem      (16px)
--radius-lg:   1.5rem    (24px)
--radius-xl:   3rem      (48px)
--radius-full: 9999px    (완전한 알약/원형)
```

---

## 6. 트랜지션

```
--transition-fast:   100ms ease-out
--transition-normal: 200ms ease-out
--transition-bounce: 300ms cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 7. Z-index 레이어

```
--z-base:   1
--z-panel:  10
--z-header: 20
--z-modal:  100
--z-toast:  200
```

---

## 8. 버튼 스타일 규칙

### 기본 버튼 (홈 화면 / 게임 내)
```css
background: color-mix(in srgb, playerColor 35%, #f0ece5)  /* 파스텔 */
color: #3d2b1f                                              /* 다크 브라운 텍스트 */
border: 2px solid color-mix(in srgb, playerColor 80%, #555)
border-radius: var(--radius-full) 또는 var(--radius-lg)
box-shadow: 0 4px 0 rgba(0,0,0,0.3)                       /* 하드 오프셋 그림자 */
```

### 버튼 인터랙션
```css
:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 rgba(0,0,0,0.3);   /* 그림자 제거로 눌리는 느낌 */
}
```

### 모바일 최소 터치 타겟
```css
/* 주요 제어 버튼만 적용 (.panel-back-btn, #btn-start-mobile 등) */
@media (max-width: 640px) {
  min-height: 44px;
}
```

---

## 9. 게임 셀 / 카드 스타일

### 번호/선택 셀 (number-hunt, number-pop 등)
```css
background: color-mix(in srgb, playerColor 15%, #f0ece5)  /* 연한 파스텔 */
border: 2px solid color-mix(in srgb, playerColor 45%, #c8b89a)
color: #3d2b1f
border-radius: clamp(4px, 1vmin, 10px)
```

### 정답 선택 후
```css
background: color-mix(in srgb, playerColor 70%, #f0ece5)  /* 진한 파스텔 */
border-color: playerColor
```

### 퀴즈 답안 버튼
```css
background: color-mix(in srgb, color 35%, #f0ece5)
border: 2px solid color-mix(in srgb, color 80%, #555)
```

---

## 10. 플레이어 패널 구조

```
.player-panel (flex column)
├── .panel-header          — 플레이어 번호, 게임명, 뒤로가기 버튼
│   ├── .panel-player-badge  — 플레이어 번호 원형 배지
│   ├── .panel-game-name     — 현재 게임명
│   └── .panel-back-btn      — 뒤로가기 버튼
├── .panel-timer-bar       — 얇은 타이머 프로그레스 바 (6px)
└── .panel-content         — 게임 렌더링 영역 (flex:1, overflow:hidden)
```

- 패널 테두리: `outline: 4px solid var(--panel-color)`
- 헤더 배경: `color-mix(in srgb, panel-color 20%, surface-container)`

---

## 11. 레이아웃 (멀티플레이어)

| 레이아웃 | `data-layout` | 설명 |
|---------|--------------|------|
| 1명 | `"1"` | 전체 화면 1개 패널 |
| 2명 | `"2"` | 가로 2등분 |
| 3명 | `"3"` | 가로 3등분 |
| 4명 (세로) | `"4-strips"` | 가로 4등분 |
| 4명 (격자) | `"4-grid"` | 2×2 그리드 |
| 퀴즈 | `"quiz"` | 세로 단일 열 |

**모바일 (≤600px)**: 2명/3명 레이아웃은 세로 스택으로 전환

---

## 12. 캔버스 게임 배경

모든 게임의 캔버스 또는 컨테이너 배경:
```css
background: #f7f3ee;  /* warm beige — 전 게임 공통 */
```

캔버스 초기화(fillRect) 시도 동일하게 `#f7f3ee` 사용.

---

## 13. 애니메이션 (keyframes)

| 이름 | 용도 |
|------|------|
| `bounceIn` | 버튼/카드 등장 (바운스) |
| `titleDrop` | 타이틀 낙하 |
| `floatUp` | 버블 위로 부상 |
| `popCorrect` | 정답 버블 팝 |
| `shake` | 오답 흔들기 |
| `scoreFlash` | 점수 플래시 |
| `pulseGlow` | 글로우 맥박 |
| `timerPulse` | 타이머 카운트다운 |
| `fadeIn` | 페이드 인 |
| `slideUp` | 아래에서 위로 슬라이드 |
| `wobble` | 귀여운 흔들기 (승리/아이들) |
| `heartbeat` | 하트비트 (점수/승리 강조) |

---

## 14. 파비콘

| 파일 | 용도 |
|------|------|
| `favicon.svg` | 모던 브라우저 (SVG, 선명하게 확대/축소) |
| `favicon-32.png` | 일반 브라우저 탭 |
| `favicon-16.png` | 작은 탭 아이콘 |
| `apple-touch-icon.png` | iOS 홈 화면 (180×180) |
| `icon-192.png` | Android PWA (192×192) |

스타일: 투명 배경 + 주황색(`#e8630a`) 게임패드 + 다크 브라운(`#3d2b1f`) 윤곽선

---

## 15. 모바일 대응

```css
/* 뷰포트 */
<meta name="viewport" content="..., viewport-fit=cover">

/* 안전 영역 */
padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
bottom: calc(0.6rem + env(safe-area-inset-bottom, 0px));

/* ≤640px */
#screen-home → flex-direction: column
.settings-sidebar → display: none (top-bar로 대체)
.game-grid → 3컬럼

/* ≤600px */
2명/3명 패널 → flex-direction: column (세로 스택)
```
