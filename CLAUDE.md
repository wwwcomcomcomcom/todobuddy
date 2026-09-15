# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 구조

npm 워크스페이스 하나에 두 모듈이 들어 있다. `app/` (Flutter 클라이언트), `server/` (Node.js + SQLite API).
루트에서 `npm run ...` 로 양쪽을 돌린다. 도메인 설명과 API 표는 @README.md 참고.

## 명령어

```bash
npm test            # 서버 + 앱 (golden 제외)
npm run test:server # node --test
npm run test:app    # flutter test --exclude-tags golden
npm run test:golden # 골든만. 실패하면 --update-goldens 전에 렌더 결과를 눈으로 확인할 것
npm run server      # 서버 (기본 127.0.0.1:4000)
npm run seed        # 데모 데이터 재생성
```

- 서버 테스트는 **인자 없는 `node --test`** 여야 한다. `node --test test/` 는 `MODULE_NOT_FOUND` 로 죽는다.
- 앱 코드를 고친 뒤에는 `cd app && flutter analyze` 도 돌린다. 경고 0 을 유지하고 있다.

## 서버

- DB 는 Node 내장 `node:sqlite` 다 (Node ≥ 22.5 필요). **`better-sqlite3` 같은 네이티브 드라이버를 추가하지 말 것** — 무의존성으로 굴러가는 게 이 모듈의 전제다. 런타임 의존성은 express, cors 둘뿐이다.
- JWT 도 `node:crypto` 로 직접 서명한다. `jsonwebtoken` 추가 금지.
- 모든 SQL 은 `src/db.js` 의 `all/get/run/tx` 를 거친다. 여러 문장을 쓸 때는 `tx()` 로 감싼다.
- 카테고리 가시성 규칙은 **`src/visibility.js` 한 곳에만** 둔다. 라우트에서 직접 공개 범위를 판단하지 말 것.
- 개발용 로그인(`POST /auth/dev`)은 기본 비활성이다. `TODOBUDDY_ALLOW_DEV_LOGIN=true` 일 때만 열린다. 서버 테스트는 spawn 할 때 이 값을 켜서 띄운다.
- 개발용 로그인 계정의 이메일은 `auth.js` 의 `devEmail()` 로 만든다. 시드와 라우트가 같은 함수를 써야 시드 계정으로 로그인된다.

## 도메인 불변식

- TODO 는 `(카테고리, 날짜)` 에 귀속된다. 날짜는 항상 `YYYY-MM-DD` 문자열이다.
- **쓰기는 본인 소유 카테고리에만 허용된다.** 친구·크루 화면은 읽기 전용이다. 새 쓰기 라우트를 추가하면 소유권을 반드시 확인할 것.
- 공개 범위는 `private` / `shared` / `public` 셋뿐이다. `public` 은 모든 친구 + 내가 속한 모든 크루에 자동 노출된다.
- 스코프 문자열은 `me` · `user:<id>` · `crew:<id>` 세 가지고, `resolveScope()` 가 해석한다.

## 앱

- 상태는 `AppState` (provider) 하나뿐이다. 화면은 여기에만 의존한다.
- `Visibility` 는 Flutter 위젯 이름과 겹치므로 도메인 enum 은 `CategoryVisibility` 다.
- 서버 주소는 `--dart-define=TODOBUDDY_API=...` 로 바꾼다. 기본값은 `http://127.0.0.1:4000`.
- 다이얼로그 안의 `TextEditingController` 는 **다이얼로그 자신의 State 가 소유**해야 한다. 호출부에서 만들어 `showDialog` 뒤에 dispose 하면 닫히는 애니메이션 도중 "used after being disposed" 로 터진다. 한 줄 입력은 `showTextPromptDialog()` 를 쓸 것.
- `Column` 안에서 `ColoredBox` 로 색 띠를 그릴 때는 `crossAxisAlignment: stretch` 가 필요하다. 없으면 교차축 loose 제약 때문에 너비 0 으로 접혀 아무것도 안 보인다 (캘린더 색칠에서 실제로 났던 버그).

## 빌드 대상

- **macOS**: `macos/Runner/*.entitlements` 두 파일 모두에 `network.client`(서버 호출), `network.server`(구글 loopback 수신), `files.user-selected.read-only`(프로필 사진) 가 있어야 한다. `flutter create` 를 다시 돌리면 날아갈 수 있으니 이후 꼭 확인할 것.
- **Windows**: 코드는 준비돼 있지만 `flutter build windows` 는 Windows 호스트에서만 돈다. macOS 에서 확인 불가.
- **Web**: `web/` 는 있고 빌드도 통과하지만 **지원 대상이 아니다.** 구글 로그인이 쓰는 `dart:io` 의 `HttpServer` 는 웹에서 컴파일만 되는 스텁이라 런타임에 throw 한다. 웹을 붙이려면 `lib/api/google_sign_in.dart` 를 조건부 import 로 갈라 리다이렉트 방식을 따로 구현해야 한다.
- 데스크탑 세 플랫폼은 같은 코드·같은 로그인 흐름(loopback + PKCE)을 쓴다.

## 커밋

`/git-commit` 스킬로 커밋한다.
