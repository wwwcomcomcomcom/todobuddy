#!/usr/bin/env bash
set -euo pipefail

# 서명 없이(ad-hoc) macOS 릴리스 빌드를 ZIP 으로 묶는다.
#
# DMG 가 아니라 ZIP 인 이유: ad-hoc 서명된 디스크 이미지는 Gatekeeper 가 마운트 단계에서
# 거부해 버려서, 사용자가 안내문에 도달할 수조차 없다. ZIP 은 압축 해제가 검사 대상이 아니라
# 앱과 안내문까지는 닿고, 차단은 실행 시점으로 밀린다 (거기서는 "그래도 열기" 가 가능하다).
#
# 정식 Developer ID 인증서가 생기면 codesign 부분을 `-sign "Developer ID Application: ..."` 로
# 바꾸고 notarytool 공증 단계를 추가하면 경고 자체가 사라진다.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

APP_NAME="Todo Buddy"
VERSION="$(grep '^version:' pubspec.yaml | head -1 | awk '{print $2}' | cut -d'+' -f1)"

BUILD_APP="$APP_DIR/build/macos/Build/Products/Release/${APP_NAME}.app"
DIST_DIR="$APP_DIR/build/dist"
STAGING_DIR="$DIST_DIR/TodoBuddy-${VERSION}"
ZIP_PATH="$DIST_DIR/TodoBuddy-${VERSION}-macos.zip"

# 앱이 바라볼 서버 주소. 안 넘기면 개발용 기본값 그대로 빌드된다.
API_URL="${TODOBUDDY_API:-http://127.0.0.1:4000}"

echo "==> flutter build macos --release (API: $API_URL)"
flutter build macos --release --dart-define="TODOBUDDY_API=$API_URL"

# 샌드박스 엔타이틀먼트가 서명에 실려야 하므로 ad-hoc 이라도 서명은 한다.
echo "==> ad-hoc codesign"
codesign --force --deep --sign - \
  --entitlements "$APP_DIR/macos/Runner/Release.entitlements" \
  "$BUILD_APP"

echo "==> 스테이징 준비"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$BUILD_APP" "$STAGING_DIR/"

cat > "$STAGING_DIR/처음 실행 시 읽어주세요.txt" <<'EOF'
Todo Buddy 를 처음 열 때

이 앱은 Apple Developer 인증서로 서명되지 않았습니다.
그래서 처음 실행할 때 macOS 가 한 번 막습니다. 아래 둘 중 하나로 열면 됩니다.


방법 1 — 시스템 설정에서 허용 (터미널 없이)

  1) "Todo Buddy.app" 을 응용 프로그램 폴더로 옮깁니다.
  2) 더블클릭합니다. 열 수 없다는 경고가 뜨면 닫습니다.
  3) 시스템 설정 > 개인정보 보호 및 보안 을 엽니다.
  4) 아래로 내려 "보안" 항목에서 Todo Buddy 에 대한 "그래도 열기" 를 누릅니다.
  5) 확인 창이 한 번 더 뜨면 "열기" 를 누릅니다.

  그 다음부터는 평소처럼 더블클릭으로 열립니다.


방법 2 — 터미널 한 줄

  앱을 응용 프로그램 폴더로 옮긴 뒤 아래를 실행합니다.

    xattr -dr com.apple.quarantine "/Applications/Todo Buddy.app"

  인터넷에서 받은 파일에 붙는 격리 표시를 지웁니다.


참고

  macOS 15 부터는 우클릭 > 열기 로 넘어가던 예전 방법이 없어졌습니다.
  인터넷에 그렇게 안내된 글이 많지만 지금 macOS 에서는 동작하지 않습니다.
EOF

echo "==> ZIP 생성: $ZIP_PATH"
rm -f "$ZIP_PATH"
# 일반 zip 은 심볼릭 링크와 확장 속성을 망가뜨려 서명이 깨진다. ditto 를 써야 한다.
ditto -c -k --keepParent "$STAGING_DIR" "$ZIP_PATH"

rm -rf "$STAGING_DIR"

echo "✅ 완료: $ZIP_PATH"
