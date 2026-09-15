# TodoBuddy

친구·크루와 하루치 할 일을 나눠 보는 크로스플랫폼 데스크탑 TODO 앱.

한 저장소 안에 세 모듈이 들어 있습니다.

| 모듈 | 내용 |
| --- | --- |
| `app/` | Flutter 클라이언트 |
| `server/` | Node.js + SQLite API 서버 (의존성: express, cors) |
| `web/` | 소개 사이트 (Next.js + TypeScript + Tailwind). 랜딩·이용약관·개인정보 처리방침 |

### 빌드 대상

| 대상 | 상태 | 비고 |
| --- | --- | --- |
| macOS | 확인됨 | debug·release 빌드 및 실기 실행 확인 |
| Windows | 확인됨 | GitHub Actions 의 `windows-latest` 에서 빌드·배포. macOS 호스트에서는 빌드 불가 |
| Linux | 지원하지 않음 | 스캐폴드를 제거했습니다. 되살리려면 `flutter create --platforms=linux .` |
| Web | 빌드만 가능 | 아래 참고 |

두 데스크탑 플랫폼은 **같은 코드**로 돕니다. 로그인 방식(loopback + PKCE)도 동일합니다.

**웹은 아직 로그인이 안 됩니다.** `flutter build web` 자체는 통과하고 개발용 로그인도 되지만,
구글 로그인이 쓰는 `dart:io` 의 `HttpServer` 는 웹에서 런타임에 예외를 던집니다
(웹의 `dart:io` 는 컴파일만 되는 스텁). 브라우저는 스스로 포트를 열 수 없으므로
웹을 지원하려면 `lib/api/google_sign_in.dart` 를 조건부 import 로 갈라
리다이렉트 방식(세션 스토리지에 verifier 보관 → 돌아온 URL 에서 code 수거)을 따로 붙여야 합니다.
서버도 데스크탑용과 별개인 "웹 애플리케이션" 유형 OAuth 클라이언트 자격증명이 필요합니다.

## 빠르게 실행하기

```bash
npm install                        # server 워크스페이스 의존성
cp server/.env.example server/.env # 개발용 로그인을 켜기 위해 필요
npm run seed                       # 데모 데이터 (하루 / 민서 / 달리기모임 크루)
npm run server                     # http://127.0.0.1:4000

cd app && flutter run -d macos     # 또는 -d windows
```

로그인 화면에서 **이름만으로 시작하기(개발용)** 를 누르고 `하루` 를 입력하면 시드 계정으로 들어갑니다.

개발용 로그인은 이름만으로 계정을 만드는 통로라 **기본은 꺼져 있습니다**.
`.env` 의 `TODOBUDDY_ALLOW_DEV_LOGIN=true` 일 때만 열리고, 꺼져 있으면 로그인 화면에도 나타나지 않습니다.

## 소개 사이트

`web/` 는 앱을 소개하고 내려받게 하는 정적 사이트입니다.
구글 OAuth 심사에 필요한 **홈페이지 · 이용약관 · 개인정보 처리방침** 세 페이지가 여기 있습니다.

```bash
npm run web        # http://localhost:3000
npm run web:build  # 정적 빌드 (모든 페이지가 프리렌더됩니다)
```

| 경로 | 내용 |
| --- | --- |
| `/` | 랜딩. 앱 소개와 플랫폼별 내려받기 |
| `/terms` | 이용약관 |
| `/privacy` | 개인정보 처리방침 |

색과 모양은 `app/lib/theme.dart` 의 팔레트를 그대로 가져와 앱과 같은 인상을 유지합니다.

배포용 상수는 `web/lib/site.ts` 에 모여 있고, 환경변수로 덮어쓸 수 있습니다.

| 값 | 환경변수 | 지금 값 |
| --- | --- | --- |
| 사이트 주소 | `NEXT_PUBLIC_SITE_URL` | `https://todobuddy.https.gsmsv.site` |
| 문의 메일 | `NEXT_PUBLIC_CONTACT_EMAIL` | `iieiiergn@gmail.com` |
| GitHub 저장소 | `NEXT_PUBLIC_GITHUB_REPO` | `wwwcomcomcomcom/todobuddy` |

내려받기 버튼은 GitHub Releases 의 최신 릴리스로 보냅니다.
`v` 로 시작하는 태그를 올리면 워크플로가 macOS·Windows ZIP 을 만들어 릴리스에 붙입니다.

**배포 빌드가 바라볼 서버 주소는 저장소 변수로 정합니다.**
GitHub 의 `Settings > Secrets and variables > Actions > Variables` 에 `TODOBUDDY_API` 를 넣으면
워크플로가 `--dart-define` 으로 빌드에 박습니다. 비워 두면 개발용 기본값(`http://127.0.0.1:4000`)으로
빌드되어, 내려받은 사람이 직접 서버를 띄워야 합니다.

```bash
gh variable set TODOBUDDY_API --body "https://api.example.com"
```

macOS 는 App Transport Security 때문에 `https` 가 아니면 요청이 막힙니다. 주소는 https 여야 합니다.

## Google 로그인 붙이기

Google Cloud Console에서 OAuth 클라이언트 ID를 **데스크톱 앱** 유형으로 만든 뒤:

```bash
cp server/.env.example server/.env   # GOOGLE_CLIENT_ID / SECRET 채우기
```

`GOOGLE_CLIENT_ID` 가 채워지면 로그인 화면에 구글 버튼이 나타납니다.
흐름은 데스크탑 표준 방식인 **loopback 리다이렉트 + PKCE** 입니다.

1. 앱이 `127.0.0.1` 의 빈 포트에 잠깐 HTTP 서버를 연다
2. 시스템 브라우저로 구글 동의 화면을 띄운다
3. 구글이 그 주소로 authorization code 를 돌려준다
4. 앱은 code 만 서버로 넘기고, **토큰 교환은 서버가** 한다 (client_secret 은 앱에 두지 않는다)
5. 서버가 자체 세션 토큰(HS256 JWT)을 발급한다

## 도메인 정리

- **카테고리** — TODO 를 모아 두는 단위. 이름·색·공개설정을 가진다.
  - `private` 나만 보기
  - `shared` 고른 크루·친구에게만
  - `public` 모든 친구와 내가 속한 크루에 자동 노출
- **TODO** — `(카테고리, 날짜)` 에 귀속된다. 날짜가 바뀌면 그 날의 목록은 비어 있고,
  캘린더로 지난 날짜·앞으로 올 날짜를 오가며 읽고 쓸 수 있다.
- **캘린더 색칠** — 날짜 칸은 그 날 TODO 가 있는 카테고리 색으로 칠해진다.
  여러 카테고리면 색이 가로 띠로 쌓이고, 전부 완료면 체크, 아니면 남은 개수를 보여준다.
- **크루** — 한 명이 만들고 초대 코드로 참여한다. 각자가 그 크루에 공유하기로 한 카테고리만 모인다.
- **친구** — 요청/수락 관계. 양쪽이 동시에 요청하면 바로 성립한다.
  친구를 삭제하면 서로에게 걸어 둔 공유도 함께 정리된다.

쓰기 권한은 항상 **본인 카테고리에만** 있습니다. 친구·크루 화면은 읽기 전용입니다.

## API

모든 경로는 `Authorization: Bearer <token>` 이 필요합니다 (`/auth/*` 일부 제외).
`scope` 는 `me` · `user:<id>` · `crew:<id>` 중 하나입니다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/auth/config` | 어떤 로그인 수단이 켜져 있는지 |
| POST | `/auth/google` | `{code, codeVerifier, redirectUri}` → 세션 토큰 |
| POST | `/auth/dev` | 개발용 로그인 |
| GET PATCH | `/auth/me` | 내 프로필 조회·수정 |
| GET | `/board?scope=&date=` | 메인 화면 한 번에 (프로필 + 카테고리 + 그 날 TODO) |
| GET | `/board/calendar?scope=&year=&month=` | 캘린더 색칠용 집계 |
| GET POST | `/categories` | 내 카테고리 목록·등록 |
| PATCH DELETE | `/categories/:id` | 수정·삭제 |
| POST | `/categories/reorder` | `{ids: []}` 드래그 정렬 |
| POST | `/todos` | `{categoryId, date, title}` |
| PATCH DELETE | `/todos/:id` | 완료 토글·이름 수정·삭제 |
| GET POST | `/crews` | 내 크루 목록·생성 |
| POST | `/crews/join` | `{inviteCode}` |
| GET PATCH | `/crews/:id` | 크루 상세(멤버 포함)·수정 |
| POST | `/crews/:id/leave` | 나가기 (방장은 혼자일 때만, 크루가 삭제됨) |
| GET | `/friends` | `{friends, incoming, outgoing}` |
| GET | `/friends/search?q=` | 이름·아이디로 사용자 검색 |
| POST | `/friends/request` | `{userId}` 또는 `{handle}` |
| POST DELETE | `/friends/:id/accept`, `/friends/:id` | 수락 / 취소·거절·삭제 |
| POST | `/uploads` | `{filename, dataBase64}` → `{url}` (프로필 사진) |

## 테스트

```bash
npm test               # 서버 + 앱
npm run test:server    # node --test (공개 범위·친구 관계·날짜 귀속 규칙)
npm run test:app       # flutter test (로그인 → 메인 화면 렌더 → 상호작용)
```

메인 화면을 실제 픽셀로 그려 보는 골든 테스트는 따로 돌립니다.

```bash
npm run test:golden                                      # 검증
cd app && flutter test --tags golden --update-goldens    # 갱신
```

## 데이터

SQLite 파일은 `server/data/todobuddy.db`, 업로드한 프로필 사진은 `server/uploads/` 에 쌓입니다.
둘 다 `.gitignore` 에 들어 있고, 지우고 `npm run seed` 를 다시 돌리면 초기 상태로 돌아갑니다.

## 알아 둘 것

- macOS 앱은 샌드박스에서 돕니다. `macos/Runner/*.entitlements` 에
  `network.client`(서버 호출), `network.server`(구글 loopback 수신),
  `files.user-selected.read-only`(프로필 사진 선택) 가 켜져 있어야 합니다.
- 서버 주소를 바꾸려면 빌드할 때 넘깁니다.
  ```bash
  flutter run -d macos --dart-define=TODOBUDDY_API=http://127.0.0.1:5000
  ```
