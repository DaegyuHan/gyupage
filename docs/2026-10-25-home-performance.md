# 홈 화면 진입 속도 개선 (2026-10-25)

규페이지 홈에 들어올 때 느리던 부분을 6가지로 나눠 고친 기록이에요.
각 항목마다 **As-Is(이전)** → **To-Be(이후)**, 바꾼 파일, 기대 효과를 적었어요.

## 한눈에 보기

| # | 항목 | As-Is | To-Be | 효과 |
|---|---|---|---|---|
| 1 | 서버 위치 | 미국 워싱턴(iad1, Vercel 기본) | 서울(icn1) | 모든 API 왕복 시간 크게 단축 |
| 2 | 홈 첫 화면 | 로그인 확인 → 일정 로딩이 끝날 때까지 빈 화면 | 화면에 붙자마자 그리고, 일정 칸만 "불러오는 중" | 첫 화면 표시가 네트워크를 기다리지 않음 |
| 3 | DB 표 확인 | 서버가 깨어날 때마다 쿼리 약 10번 | 표가 다 있으면 쿼리 1번 | 콜드 스타트 지연 감소 |
| 4 | 공용 데이터 | 열 때마다 서버 함수 실행 | Vercel CDN에 1~30분 보관 | 두 번째부터 거의 즉시 응답 |
| 5 | 아래쪽 칸 | 홈 열자마자 15개 넘는 요청이 한꺼번에 | 화면 근처에 올 때 불러오기 | 첫 화면 요청 수 감소 (특히 휴대폰) |
| 6 | 글꼴 | 외부 CSS를 그냥 받음 | 글꼴 서버에 미리 연결(preconnect) | 첫 글자 표시가 조금 빨라짐 |

---

## 1. Vercel 서버 위치를 서울로

**As-Is**
- Vercel 함수는 기본 리전인 **미국 워싱턴(iad1)**에서 실행됐어요.
- DB(Neon)는 **싱가포르(ap-southeast-1)**에 있어요.
- 한국에서 요청하면 한국 → 미국 → (DB) 싱가포르 → 미국 → 한국으로, 태평양을 여러 번 오갔어요.

**To-Be**
- `vercel.json`에 서울 리전을 지정했어요.
  ```json
  { "framework": "nextjs", "regions": ["icn1"] }
  ```
- 이제 한국 → 서울 → 싱가포르(가까움) → 서울 → 한국이에요.

**바꾼 파일**: `vercel.json`

---

## 2. 홈이 일정을 기다리지 않고 바로 그려지게

**As-Is**
- `HomeView`가 `store.loaded`(일정 로딩 완료)가 될 때까지 빈 `div`만 그렸어요.
- 순서가 ① `/api/auth/me`로 로그인 확인 → ② `/api/events` + `/api/todos`로 DB 조회(서버가 잠들어 있으면 깨우는 시간 포함)여서, 이 둘이 끝나야 날짜, 할 일, 날씨, 뉴스까지 한꺼번에 보였어요.

**To-Be**
- **화면에 붙은 직후(mount)** 바로 그려요. 서버(UTC)와 브라우저(KST)의 '오늘'이 달라 생기는 문제를 막으려고 mount만 기다리고, 네트워크는 기다리지 않아요.
- 일정이 아직 없으면 그 칸만 "일정 불러오는 중…"으로 보여줘요. `TodayHero`와 `WeekBoard`에 `loading` prop을 추가했어요.
- **로그인 확인 단축**
  - 로그인할 때 `gp_in=1`이라는 **표시용 쿠키**를 같이 남겨요. 자바스크립트가 읽을 수 있고, 값은 1뿐이에요.
  - 다음 방문부터는 이 표시가 있으면 서버에 묻기 전에 바로 '로그인됨'으로 시작하고, 실제 확인(`/api/auth/me`)은 뒤에서 해요.
  - 실제 인증은 기존처럼 서버만 읽을 수 있는 `gp_session`(HttpOnly, HMAC 서명) 쿠키로 해요. 그래서 표시 쿠키를 조작해도 데이터는 볼 수 없어요. 서버 확인에서 세션이 끝난 게 드러나면 표시 쿠키도 지워요.

**바꾼 파일**
- `src/components/home/HomeView.tsx`: 로딩 대기 제거, mount 후 바로 렌더
- `src/components/calendar/TodayHero.tsx`, `src/components/home/WeekBoard.tsx`: `loading` 표시
- `src/lib/auth-client.ts`: 표시 쿠키로 즉시 시작
- `src/lib/server/auth.ts`: `SESSION_HINT` 상수
- `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`: 표시 쿠키를 넣고 지움

---

## 3. DB 표 확인을 쿼리 1번으로

**As-Is**
- 서버(서버리스 함수)가 새로 깨어날 때마다 `ensureSchema()`가 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`를 **약 10번 연달아** 실행했어요. Neon HTTP라 쿼리마다 왕복 시간이 들어요.
- 로그인 확인용 `/api/auth/me`도 매번 DB에 접속했어요.

**To-Be**
- 먼저 쿼리 1번으로 표 5개(events, todos, prefs, books, reading_logs)가 모두 있는지 확인하고, 다 있으면 바로 끝내요.
  ```sql
  SELECT to_regclass('public.events') IS NOT NULL AND ... AS ok
  ```
- 표가 하나라도 없을 때만 만들기를 실행해요.
- `/api/auth/me`는 쿠키만 확인해요. DB 연결을 진단하고 싶을 때만 `?check=1`을 붙여요.

**바꾼 파일**: `src/lib/server/db.ts`, `src/app/api/auth/me/route.ts`

---

## 4. 공용 데이터는 Vercel CDN에 캐시

**As-Is**
- 뉴스나 축구처럼 누가 봐도 같은 데이터도, 요청마다 서버 함수가 실행됐어요.
- 함수 안의 `unstable_cache` 덕에 외부 API 호출은 줄었지만, **함수가 깨어나고 실행되는 시간**은 매번 들었어요.

**To-Be**
- 응답에 `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`를 붙여서, Vercel CDN이 응답을 보관했다가 바로 돌려줘요.
- 보관 시간이 지난 뒤에도 일정 시간 동안은 이전 응답을 먼저 주고, 새 응답은 뒤에서 받아 둬요(stale-while-revalidate).
- 헬퍼 `cdn(seconds, swr)`를 만들어 공통으로 써요.

| API | 보관 시간 (s-maxage) |
|---|---|
| `/api/football` | 60초 (진행 중인 경기) |
| `/api/esports`, `/api/myteam`, `/api/home-matches` | 3분 |
| `/api/news`, `/api/f1`, `/api/weather`, `/api/steam`, `/api/lol` | 10분 |
| `/api/github` | 15분 |
| `/api/maple` | 30분 |

- **캐시하지 않는 것**: 일정, 할 일, 독서, 설정, 로그인 같은 **내 데이터**(로그인 필요한 API)는 그대로 매번 서버에서 읽어요.
- 오류 응답에는 캐시 헤더를 붙이지 않아서, 실패한 결과가 남지 않아요.

**바꾼 파일**: `src/lib/server/cache.ts`(새 파일), 위 표에 있는 각 `src/app/api/*/route.ts`

---

## 5. 아래쪽 칸은 화면에 가까워질 때 불러오기

**As-Is**
- 홈을 열면 뉴스, Daily CS, GitHub, 게임, 독서, F1, e스포츠 등이 **한꺼번에** 데이터를 요청했어요. 15개가 넘었어요.
- 휴대폰에서는 첫 화면에 보이지도 않는 칸들이 네트워크를 같이 차지했어요.

**To-Be**
- `LazyMount` 컴포넌트를 만들었어요. `IntersectionObserver`로 화면 아래 **600px 안**에 들어오면 그때 칸을 그리고 요청해요.
- 그 전에는 비슷한 높이의 빈 자리만 둬서 스크롤할 때 화면이 출렁이지 않아요.
- 넓은 화면에서는 대부분 처음부터 600px 안이라 예전처럼 바로 불러와요. 휴대폰에서 효과가 커요.

| 지연 로딩 적용 | 바로 로딩 (첫 화면) |
|---|---|
| 관심분야 소식, Daily CS, GitHub, Games, 독서, F1, LoL e스포츠 | 오늘(할 일), 일정·날씨, 시간별 날씨, My Team, 축구 |

**바꾼 파일**: `src/components/LazyMount.tsx`(새 파일), `src/components/home/HomeView.tsx`

---

## 6. 글꼴 서버 미리 연결

**As-Is**
- 본문 글꼴(SUIT)의 CSS를 jsDelivr에서 받을 때, 브라우저가 그때 처음 연결(DNS, TLS)을 시작했어요.

**To-Be**
- `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="">`로 미리 연결해 둬요.

**바꾼 파일**: `src/app/layout.tsx`

---

## 확인한 것 / 남은 것

- [x] 타입 검사(`tsc --noEmit`) 통과
- [ ] Vercel 배포 후 휴대폰에서 체감 확인. 서울 리전과 CDN 캐시는 배포해야 적용돼요.
- [ ] 필요하면 Vercel → Speed Insights로 실제 수치(LCP, TTFB) 비교

### 다음에 더 해볼 만한 것
- 글꼴(SUIT)을 `next/font/local`로 직접 서빙하기 (외부 요청 자체를 없앰)
- 홈의 공용 데이터를 서버 컴포넌트에서 미리 받아 첫 HTML에 넣기 (클라이언트 요청 수를 더 줄임)
- Neon 무료 플랜의 자동 일시 정지(scale to zero) 때문에 생기는 첫 접속 지연 확인
