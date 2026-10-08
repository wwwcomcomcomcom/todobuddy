# React + TS PWA 전환 계획

Flutter 데스크탑 클라이언트(`app/`)를 React + TypeScript 로 다시 쓰고 PWA 로 배포한다.
서버(`server/`)는 유지하되 웹 클라이언트에 필요한 것만 **추가**한다.

## 왜

- macOS·Windows·Android·iOS 코드 서명을 준비하기 어렵다. 지금 배포본은 ad-hoc 서명 ZIP 이라
  Gatekeeper·SmartScreen 경고를 사용자가 직접 넘겨야 하고, 모바일은 아예 없다.
- PWA 는 HTTPS 도메인 하나로 모든 플랫폼에 설치된다. 업데이트도 배포 즉시 반영된다.
- 이 앱은 서버가 원본인 온라인 전용 앱이라 웹으로 옮겨도 잃는 기능이 적다 (아래 "잃는 것" 참고).

## 목표 / 비목표

**목표**

- 현재 Flutter 앱의 모든 화면·동작을 `pwa/` 모듈에서 같은 서버 API 로 재현한다.
- 데스크탑 브라우저(Chrome·Edge·Safari)와 모바일(iOS Safari·Android Chrome)에서 설치해 쓸 수 있다.
- 서명·스토어 없이 배포한다.

**비목표 (이번 범위 밖)**

- 오프라인 편집·동기화. 지금도 없다. 앱 껍데기 캐시와 "오프라인입니다" 화면까지만 한다.
- 웹 푸시 알림. 지금 앱에 알림 기능이 없다. 필요해지면 별도 계획으로.
- 스토어 등록(PWABuilder·TWA). 필요해지면 PWA 위에 얹는다.
- 서버를 Next.js 등으로 옮기는 것. 서버는 express + `node:sqlite` 그대로 둔다.

## 현재 상태 (master `1e68b28` 기준)

Flutter 코드 약 6,000줄. 의존성은 `http`, `provider`, `shared_preferences`, `url_launcher`,
`file_selector`, `crypto` 뿐이다.

| 영역 | Flutter 파일 | 웹으로 옮길 때 |
| --- | --- | --- |
| 상태 | `state/app_state.dart` (347) | 단일 스토어로 이식. 화면은 여기에만 의존한다는 규칙 유지 |
| API | `api/api_client.dart` (253), `models/*.dart` | `fetch` 래퍼 + TS 타입. 엔드포인트 1:1 |
| 구글 로그인 | `api/google_sign_in.dart` (loopback + PKCE, `dart:io`) | **서버 리다이렉트 방식으로 교체** (Phase 1) |
| 토큰 저장 | `shared_preferences` | **httpOnly 쿠키로 교체** (Phase 1) |
| 메인 | `screens/home_screen.dart`, `widgets/{scope_bar,month_calendar,todo_column,profile_card}.dart` | 이식 + 모바일 레이아웃 신규 |
| 카테고리 | `category_form_screen.dart`, `category_manage_screen.dart` (`ReorderableListView`) | 드래그 정렬은 포인터·터치 둘 다 되게 |
| 반복 일정 | `routine_form_screen.dart` (576), `routine_manage_screen.dart` (380), `models/routine.dart` | 이식. 날짜 계산은 서버(`/routines/preview`)가 하므로 클라이언트 로직은 얇다 |
| 사람 | `people_screen.dart` (친구·크루) | 이식 |
| 프로필 | `profile_edit_dialog.dart` (`file_selector`) | `<input type="file">` |
| 투두메이트 가져오기 | `services/todomate_client.dart`, `todomate_import_screen.dart` | `init.json` 이 CORS 를 막으므로 **키만 서버 경유** (Phase 1) |
| 자체 업데이트 | `services/update_{checker,installer}.dart`, `widgets/update_{gate,dialog}.dart`, `config/update_config.dart` | **삭제.** 서비스워커 업데이트 안내로 대체 |
| 자동 실행 | `services/startup_service.dart` + 네이티브 MethodChannel, `settings_screen.dart` | **웹으로 옮길 수 없음.** 설정 화면에서 빠진다 |

브라우저 CORS 확인 결과 (2026-10 직접 확인):

- `identitytoolkit.googleapis.com`, `firestore.googleapis.com` — 허용. 브라우저에서 직접 호출 가능.
- `www.todomate.net/__/firebase/init.json` — `Access-Control-Allow-Origin` 없음. 브라우저에서 못 읽는다.

## 결정 사항

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 모듈 위치 | 새 워크스페이스 `pwa/` | `web/` 는 "독립된 정적 소개 사이트" 규칙이 있다. 섞지 않는다 |
| 프레임워크 | Vite + React + TypeScript (SPA) | 로그인 뒤에만 쓰는 앱이라 SSR·SEO 가 필요 없다. 정적 파일로 서빙 |
| 스타일 | Tailwind v4, `@theme` 토큰 | `web/` 와 같은 방식. 색은 `app/lib/theme.dart` 팔레트 |
| 라우팅 | `react-router` | 화면 전환(메인·카테고리·반복·사람·설정·가져오기)과 뒤로 가기 |
| 서버 상태 | 단일 스토어(Context + reducer 또는 `useSyncExternalStore`) | `AppState` 하나라는 현재 구조를 그대로 옮긴다. 필요해지기 전엔 캐시 라이브러리를 넣지 않는다 |
| 드래그 정렬 | `@dnd-kit` | 터치·키보드 접근성을 직접 구현하지 않기 위해 |
| PWA | `vite-plugin-pwa` (Workbox) | 매니페스트·프리캐시·업데이트 감지를 직접 짜지 않기 위해 |
| 출처 | **PWA 와 API 를 같은 출처**에서 서빙, API 는 `/api/*` | CORS·쿠키 문제가 사라진다. 프록시가 `/api` 접두어를 떼고 `127.0.0.1:4000` 으로 넘긴다 |
| 인증 | 서버가 발급하는 httpOnly 쿠키 | localStorage 토큰은 XSS 에 털리고, Safari 가 7일 미사용 시 지울 수 있다 |
| 구글 로그인 | 서버 주도 리다이렉트 + PKCE, "웹 애플리케이션" 유형 OAuth 클라이언트 | 브라우저는 loopback 포트를 열 수 없다 |
| 투두메이트 키 | 서버가 `init.json` 을 대신 읽어 `apiKey`·`projectId` 만 전달 | 비밀번호·토큰·일정은 브라우저 → 구글로 직행. 서버엔 공개 설정값만 지나간다 |

의존성은 위 표에 적은 것 외에는 추가하지 않는다. 추가할 때는 이 문서에 이유를 남긴다.

표 밖에서 들어온 것과 이유:

| 패키지 | 이유 |
| --- | --- |
| `@vitejs/plugin-react`, `@tailwindcss/vite`, `typescript` | Vite + React + TS + Tailwind 를 쓰기 위한 빌드 도구 자체 |
| `@dnd-kit/sortable`, `@dnd-kit/utilities` | `@dnd-kit` 의 정렬 목록 프리셋. core 만으로는 정렬을 직접 짜야 한다 |
| `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom` | 아래 "테스트" 의 단위·컴포넌트 테스트. jsdom 은 Vitest 의 DOM 환경 |
| `@playwright/test` | 아래 "테스트" 의 e2e·시각 회귀. 컨테이너에 깔린 Chromium(1194)과 맞춰 1.56.1 로 고정 |
| `@types/node` | `vite.config.ts`·e2e 스크립트의 타입 |

아이콘 라이브러리는 넣지 않았다. 필요한 Material 아이콘 경로만 `pwa/src/components/Icon.tsx` 에 옮겨 적었다.

## 진행 상황 (2026-10-08)

| 단계 | 상태 |
| --- | --- |
| Phase 0 | 프록시·IME 확인. **iOS·Android 실기기 구글 로그인은 미확인** (결과·대안은 아래) |
| Phase 1 | 끝. `npm run test:server` 통과, Bearer(데스크탑) 경로는 그대로 |
| Phase 2~4 | 끝. 기능 대조표 전부 PWA 에서 e2e 로 확인 |
| Phase 5 | 저장소 쪽 끝 (매니페스트·서비스워커·업데이트 안내·설치 안내·배포 스크립트·CI). **운영 서버 반영과 구글 콘솔 등록이 남았다** |
| Phase 6 | 시작 안 함. 운영에 PWA 가 뜨고 사용자가 옮겨 간 뒤의 일이라 지금 하면 데스크탑 앱이 먼저 끊긴다 |

계획과 달라진 점은 해당 항목 아래에 적었다. 저장소에서는 단계별 PR 대신 한 브랜치에 단계별 커밋으로 올렸다.

## 단계

각 단계는 따로 PR 로 낸다. **Phase 5 전까지는 Flutter 데스크탑 앱이 계속 동작해야 한다.**
서버 변경은 모두 추가만 한다 (배포 스크립트가 DB 를 되돌리지 않으므로 롤백 가능성 유지).

### Phase 0 — 스파이크 (버리는 코드)

실기기에서 가장 불확실한 것부터 확인한다.

- [ ] iOS 홈 화면 앱(standalone)에서 구글 리다이렉트 로그인 → 앱으로 돌아오기 → 쿠키 유지
- [ ] Android Chrome 설치 앱에서 같은 흐름
- [x] 한글 IME 조합 중 Enter·blur 처리 (`compositionstart/end`, `isComposing`) — 할 일 입력·인라인 수정에서 글자 중복·유실 없음
- [x] 같은 출처 프록시 구성 (`/` 정적, `/api` → 서버) 로컬 재현

**완료 조건**: 위 항목 결과를 이 문서에 기록. iOS 로그인이 막히면 팝업/새 탭 방식 등 대안을 정하고 진행.

#### 결과 (2026-10-08)

스파이크 코드를 따로 만들지 않고 Phase 1~5 구현 위에서 확인했다. 실기기가 필요한 두 항목은 아직 못 봤다.

- **같은 출처 프록시 — 확인.** `pwa/vite.config.ts` 의 `server.proxy`·`preview.proxy` 가 운영과 같은 모양
  (`/api` 접두어 제거 → `127.0.0.1:4000`, `/uploads` 그대로)이다. `changeOrigin` 을 꺼 Host 가 유지되므로
  서버의 같은 출처 검사(`TODOBUDDY_WEB_ORIGIN` 이 비었을 때)를 그대로 통과한다.
  e2e 가 이 구성(빌드 → `vite preview` → 실제 서버)으로 데스크탑·모바일 뷰포트에서 돈다. 운영용 nginx 예시는 `server/deploy/nginx-todobuddy-pwa.conf`.
- **한글 IME — 확인 (Chromium).** Enter 처리 전에 `nativeEvent.isComposing || keyCode === 229` 를 거른다
  (`pwa/src/lib/keys.ts`. Chrome·Firefox 는 isComposing, Safari 는 compositionend 를 먼저 보내고 keyCode 229 를 남긴다).
  바깥 클릭 저장은 blur 가 아니라 `pointerdown` 으로 받아 조합 확정과 엇갈리지 않는다.
  Vitest 가 두 플래그를, e2e 가 CDP(`Input.imeSetComposition`)로 실제 조합 이벤트를 흉내 내 "조합 중 Enter 는 저장하지 않고, 확정 뒤 Enter 는 한 번만 그대로 저장" 을 확인한다.
  macOS Safari 의 두벌식·iOS 키보드·Android Gboard 는 실기기로 한 번 더 볼 것.
- **iOS·Android standalone 구글 로그인 — 미확인.** 지금 흐름은 같은 창의 최상위 이동이다:
  `/api/auth/google/start`(302) → 구글 → `/api/auth/google/callback` 이 세션 쿠키를 심고 `/` 로 302.
  standalone 앱에서 범위 밖(accounts.google.com)으로 나가면 앱 안의 브라우저 시트로 열리고, 범위 안으로 돌아오면 앱으로 복귀하는 것이 기대 동작이다.
  쿠키는 콜백 응답이 앱의 출처에 심으므로 앱의 쿠키 저장소에 남아야 한다.
  **막힐 때의 대안**: 로그인 버튼이 `window.open('/api/auth/google/start')` 로 새 창을 열고, 앱은 `visibilitychange`·`focus` 때 `/api/auth/me` 를 다시 불러 세션을 이어받는다
  (콜백이 쿠키를 심는 곳이 같은 출처라 어느 창에서 끝나든 상관없다). 서버는 바꿀 필요가 없다.

### Phase 1 — 서버 준비 (데스크탑과 호환 유지)

- [x] **쿠키 세션**: `requireAuth` 가 `Authorization: Bearer` 와 쿠키(`tb_session`) 둘 다 받는다.
      쿠키는 `HttpOnly; Secure; SameSite=Lax; Path=/`, 수명은 지금 JWT 와 같은 30일.
- [x] **CSRF**: 쿠키로 인증된 GET 외 요청은 `Origin` 이 허용 목록(`TODOBUDDY_WEB_ORIGIN`)과 같아야 한다.
- [x] `POST /auth/logout` — 쿠키 삭제.
- [x] `POST /auth/dev` 가 토큰 응답과 함께 쿠키도 심는다 (켜져 있을 때만).
- [x] **구글 웹 로그인**
  - `GET /auth/google/start` — state·code_verifier 생성, 짧은 수명의 서명된 쿠키에 보관, 구글로 302
  - `GET /auth/google/callback` — state 검증 → 토큰 교환(`exchangeGoogleCode` 재사용) → 세션 쿠키 → 앱으로 302
  - 새 환경변수 `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`. 데스크탑용 `GOOGLE_CLIENT_ID` 는 전환 기간 동안 유지
  - `/auth/config` 에 `googleWebEnabled` 추가
- [x] **`GET /todomate/config`** (`requireAuth`) — 고정 URL 의 `init.json` 을 읽어 `{apiKey, projectId}` 만 반환.
      메모리 캐시(수 시간), 클라이언트가 키 오류를 받으면 `?refresh=1` 로 한 번 갱신. 요청자가 URL 을 정할 수 없게 한다.
- [x] `.env.example`, README API 표 갱신
- [x] 서버 테스트: 쿠키 인증, Origin 거부, logout, todomate config(외부 호출은 주입 가능한 fetch 로 대체), 구글 start 의 리다이렉트 파라미터

**완료 조건**: `npm run test:server` 통과, 데스크탑 앱 회귀 없음.

### Phase 2 — `pwa/` 뼈대와 로그인

- [x] 루트 `package.json` 워크스페이스에 `pwa` 추가, 스크립트 `pwa`, `pwa:build`, `test:pwa`
- [x] Vite + React + TS + Tailwind, `@theme` 토큰을 `theme.dart` 에서 옮김
- [x] 개발 서버 프록시: `/api` → `http://127.0.0.1:4000` (접두어 제거)
- [x] `api.ts` (fetch 래퍼, `credentials: 'same-origin'`, 401 → 로그인 화면), `models.ts`
- [x] 스토어: `restoreSession`(= `GET /auth/me`), `signIn*`, `signOut`, `_guard` 에러 처리 이식
- [x] 로그인 화면: 구글 버튼(`/api/auth/google/start` 로 이동), 개발용 로그인

**완료 조건**: 시드 계정 `하루` 로 개발용 로그인 → 빈 메인 화면까지.

### Phase 3 — 메인 화면

- [x] 스코프 바 (`me` · `user:<id>` · `crew:<id>`), 읽기 전용 스코프에서 쓰기 UI 숨김
- [x] 월 캘린더: 카테고리 색 가로 띠, 전부 완료 체크 / 남은 개수, 월 이동
- [x] 할 일 열: 추가·완료 토글·이름 수정·삭제
  - 데스크탑: 더블 클릭 수정, 바깥 클릭 저장, 호버 시 행 높이 유지 (최근 커밋들의 동작)
  - 터치: 탭으로 수정, 길게 누르기 또는 스와이프로 삭제 — **새로 정해야 함**
    → **정함**: 한 번 탭하면 수정창이 열리고, 터치 기기(`hover: none`)의 수정창에만 🗑 삭제 버튼이 함께 나온다.
    숨은 제스처(길게 누르기·스와이프)는 발견하기 어렵고 스크롤과 부딪혀 쓰지 않았다. 마우스·터치 구분은 `pointerType` 으로 한다.
- [x] 프로필 카드, "오늘로" 이동
- [x] 반응형: 넓은 화면은 캘린더 + 할 일 2단, 좁은 화면은 1단(캘린더 접기)
  - 접으면 선택한 날이 든 주 한 줄만 남는다. 접힘 상태는 브라우저에만 저장한다 (`localStorage`).

### Phase 4 — 나머지 화면

- [x] 카테고리 등록·수정(색·공개 범위·공유 대상), 관리(드래그 정렬·삭제)
- [x] 반복 일정 등록·수정(미리보기 5개), 관리, 삭제(과거 완료/미완료 보존·오늘 삭제 선택)
- [x] 사람: 친구 목록·요청·수락·삭제·검색, 크루 생성·참여·상세·수정·나가기
- [x] 프로필 수정 + 사진 업로드(base64, 5MB 제한은 클라이언트에서도 미리 확인)
- [x] 투두메이트 가져오기 (`/api/todomate/config` 로 키 받기 → Firebase REST 직접 호출)
- [x] 설정 화면: 자동 실행 항목 제거. 대신 "앱으로 설치" 안내

**완료 조건**: 아래 "기능 대조표"의 모든 항목을 PWA 에서 확인.

### Phase 5 — PWA 화 · 배포

- [x] 매니페스트: 이름, `display: standalone`, `theme_color`, 아이콘(192·512·maskable), `apple-touch-icon`
- [x] 서비스워커: 앱 껍데기 프리캐시, `/api/*` 와 `/uploads/*` 는 네트워크 전용, 오프라인 안내 화면
  - 해시된 자산·아이콘만 프리캐시하고, 화면 이동(`index.html`)은 네트워크 우선(4초) → 오프라인이면 마지막으로 받은 것. 어느 경로든 같은 캐시 키 하나를 쓴다.
- [x] 새 버전 감지 → "새 버전이 있어요, 새로고침" 토스트 (자동 강제 새로고침 금지 — 입력 중 날아감)
- [x] 설치 안내: Chromium 은 `beforeinstallprompt`, iOS 는 공유 → 홈 화면에 추가 안내
- [ ] 운영 배포 — **저장소 쪽은 끝, 운영 서버 작업이 남았다**
  - [ ] 리버스 프록시: `/` → `pwa/dist` 정적, `/api/` → `127.0.0.1:4000` (접두어 제거), `/uploads/` 도 서버로
    — 예시는 `server/deploy/nginx-todobuddy-pwa.conf`. 서버 `.env` 에 `TODOBUDDY_WEB_ORIGIN`·`GOOGLE_WEB_CLIENT_*` 도 넣을 것
  - [x] `server/deploy/todobuddy-deploy.sh` 에 `npm ci` + `npm run pwa:build` 추가.
    **운영 서버 사본은 root 소유라 직접 다시 깔아야 한다.**
    - `npm ci` 대신 기존 `install_deps`(npm install) 를 쓴다 — 같은 체크아웃의 node_modules 로 `web` 이 돌고 있어서 지우면 안 된다.
    - `pwa/dist.next` 에 빌드 → 서버 헬스체크 통과 뒤에만 `dist` 와 바꿔 끼운다. 빌드가 깨지면 서버를 재시작하기 전에 멈추고 되돌린다.
    - [ ] 운영 서버에 새 스크립트 다시 깔기 (`sudo install -o root -m 755 server/deploy/todobuddy-deploy.sh /usr/local/bin/todobuddy-deploy`)
  - [ ] 구글 콘솔: 웹 클라이언트의 승인된 리디렉션 URI·자바스크립트 원본 등록
- [x] Lighthouse PWA·접근성 점검
  - Lighthouse 12 기준(PWA 항목은 Lighthouse 에서 빠졌다. 설치 가능 여부는 e2e 가 매니페스트·서비스워커로 확인한다):
    로그인 화면 성능 0.95 · 접근성 0.95 · 권장사항 0.96, 메인 화면 접근성 0.96 · 권장사항 1.0.
  - 남은 지적: **색 대비**. 토·일 숫자(`#3B82F6`·`#EF4444`)와 보조 글자(`#9AA0A6`)가 흰 바탕에서 4.5:1 에 못 미친다.
    앱 팔레트(`theme.dart`)를 그대로 옮긴 색이라 세 곳을 같이 바꿔야 해서 손대지 않았다. 아래 "열린 질문" 참고.
  - 로그아웃 상태의 첫 화면은 세션 확인(`GET /auth/me`)이 401 을 내 콘솔에 오류가 한 줄 남는다. 의도한 동작이다.

### Phase 6 — 전환과 정리

- [ ] 마지막 데스크탑 릴리스: 업데이트 확인 시 "웹 앱으로 옮겼어요" 안내와 PWA 주소를 띄운다 (자체 업데이트 통로를 마지막으로 활용)
- [ ] 소개 사이트(`web/`): 내려받기 버튼 → "웹 앱 열기" + 플랫폼별 설치 안내. `lib/site.ts` 의 `platforms` 교체
- [ ] `web/app/privacy/page.tsx`: 쿠키 사용, 투두메이트 처리 경로(서버는 공개 설정만 중계) 반영. 이용약관 점검
- [ ] 서버에서 데스크탑 전용 경로 정리 여부 결정 (`POST /auth/google` loopback, Bearer 인증) — 구버전 사용자가 사라진 뒤
- [ ] `app/`, `.github/workflows/desktop-build.yml`, `app/scripts/build_macos.sh` 삭제
- [ ] CLAUDE.md · README 갱신 (구조, 명령어, 빌드 대상, 앱 규칙 → PWA 규칙)

## 기능 대조표

Phase 4 완료 확인용. Flutter 테스트(`app/test/*`)의 시나리오도 여기에 포함된다.
PWA 열의 ✅ 는 실제 서버를 띄운 e2e(`pwa/e2e/*.spec.ts`, 데스크탑·모바일 뷰포트)로 확인한 것이다.

| 기능 | Flutter | PWA |
| --- | --- | --- |
| 개발용 로그인 / 구글 로그인 / 로그아웃 / 세션 복원 | ✅ | ✅ (구글은 실제 계정·실기기 미확인) |
| 스코프 전환, 남의 스코프 읽기 전용 | ✅ | ✅ |
| 날짜 선택, 월 이동, 오늘로 | ✅ | ✅ |
| 캘린더 색 띠·완료 체크·남은 개수 | ✅ | ✅ |
| 할 일 추가·토글·수정·삭제 | ✅ | ✅ |
| 카테고리 CRUD·공개 범위·공유 대상·정렬 | ✅ | ✅ |
| 반복 일정 CRUD·미리보기·삭제 옵션 | ✅ | ✅ |
| 친구 검색·요청·수락·삭제 | ✅ | ✅ |
| 크루 생성·참여·수정·나가기 | ✅ | ✅ (크루 정보 수정 화면은 Flutter 에도 없다) |
| 프로필 수정·사진 업로드 | ✅ | ✅ |
| 투두메이트 가져오기 | ✅ | ✅ (구글 API 는 가짜로, 실제 계정 미확인) |
| 업데이트 확인 | ✅ (자체 교체) | 서비스워커 안내로 대체 |
| 컴퓨터 시작 시 자동 실행 | ✅ | ❌ 제공 안 함 |

## 테스트

- **서버**: 기존 `node --test` 에 Phase 1 테스트 추가. 인자 없는 `node --test` 규칙 유지.
- **단위·컴포넌트**: Vitest + Testing Library. 스토어 로직과 할 일 편집 동작(`todo_editing_test.dart` 시나리오)을 가짜 API 로.
- **E2E**: Playwright 가 개발용 로그인을 켠 실제 서버를 띄우고 시드 데이터로 돈다
  (`app_test.dart`·`widget_test.dart` 시나리오). 데스크탑·모바일 뷰포트 둘 다.
- **시각 회귀**: 골든(`home.png`, `todo_editing.png`) 대신 Playwright 스크린샷 비교. 실패 시 갱신 전에 눈으로 확인하는 규칙은 유지.
- **CI**: PR 마다 `test:server` + `test:pwa` + `pwa:build`. 운영 러너(`todobuddy-prod`)를 쓰는 워크플로에는 `pull_request` 트리거를 붙이지 않는다.

## 잃는 것

- **컴퓨터 시작 시 자동 실행.** 웹에서 프로그래밍으로 켤 수 없다. Chromium 계열은 설치 앱 설정에서 사용자가 직접 켤 수 있다는 안내만 한다.
- **iOS 설치 버튼.** 사용자가 공유 메뉴에서 직접 추가해야 한다.
- **완전한 데스크탑 앱 느낌.** 메뉴 막대·트레이 없음. Firefox 는 설치 지원이 약하다.
- **Flutter 테스트·골든 자산.** 새 도구로 다시 쓴다.

## 위험과 대응

| 위험 | 대응 |
| --- | --- |
| iOS standalone 앱에서 OAuth 리다이렉트 후 앱으로 못 돌아오거나 쿠키가 분리됨 | Phase 0 에서 실기기로 먼저 확인. 안 되면 대안 흐름 확정 후 진행 |
| 서비스워커가 옛 껍데기를 계속 줌 | `index.html` 은 캐시하지 않거나 네트워크 우선, 해시된 자산만 프리캐시, 업데이트 토스트 |
| 투두메이트가 키·스키마를 바꿈 | 키는 서버가 따라감. 스키마 변경은 지금도 같은 위험 — 실패 메시지 유지 |
| 같은 태그로 서버·앱이 같이 나가는 구조가 깨짐 | PWA 도 같은 태그로 같은 배포 스크립트에서 빌드·반영 |
| 전환 기간 데스크탑·웹 두 클라이언트 유지 비용 | 서버는 추가만, 기능 개발은 Phase 4 이후 PWA 에만 |
| 쿠키 전환으로 CSRF 표면 생김 | `SameSite=Lax` + `Origin` 검사 + JSON 본문만 허용 |

## 열린 질문

- [ ] PWA 주소: 소개 사이트와 같은 호스트의 하위 경로인가, `app.` 같은 별도 호스트인가. (같은 출처 프록시만 지키면 어느 쪽이든 된다)
  - 지금 구현은 **호스트의 루트**를 가정한다 (매니페스트 `start_url`·`scope` = `/`, API 는 `/api`, 구글 콜백은 `/api/auth/google/callback`).
    하위 경로로 가려면 Vite `base`, 매니페스트, 서버의 콜백·돌아갈 주소를 함께 바꿔야 해서 별도 호스트(`app.`)가 간단하다.
- [x] 터치에서 할 일 삭제·수정 제스처 → 탭으로 수정, 수정창 안의 삭제 버튼 (Phase 3 참고)
- [ ] 데스크탑 클라이언트 지원 종료 시점과 구버전용 서버 경로 정리 시점
- [ ] `theme.dart` · `web/` · `pwa/` 세 곳 팔레트를 어떻게 맞출지 (Flutter 삭제 후엔 `web/` · `pwa/` 두 곳 — 공유 CSS 파일로 뺄지)
  - 맞출 때 토·일·보조 글자색의 대비(4.5:1)도 함께 정할 것 (Lighthouse 지적)
