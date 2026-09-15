#!/usr/bin/env bash
set -euo pipefail

# 서명 없이(ad-hoc) macOS 릴리스 빌드를 DMG 로 묶는다.
# 정식 Developer ID 인증서가 생기면 codesign 부분만 `-sign "Developer ID Application: ..."` 로 바꾸고
# notarytool 공증 단계를 추가하면 된다.

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

APP_NAME="Todo Buddy"
VOLUME_NAME="TodoBuddy"
VERSION="$(grep '^version:' pubspec.yaml | head -1 | awk '{print $2}' | cut -d'+' -f1)"

BUILD_APP="$APP_DIR/build/macos/Build/Products/Release/${APP_NAME}.app"
DIST_DIR="$APP_DIR/build/dist"
STAGING_DIR="$DIST_DIR/staging"
DMG_PATH="$DIST_DIR/${VOLUME_NAME}-${VERSION}.dmg"

echo "==> flutter build macos --release"
flutter build macos --release

echo "==> ad-hoc codesign"
codesign --force --deep --sign - \
  --entitlements "$APP_DIR/macos/Runner/Release.entitlements" \
  "$BUILD_APP"

echo "==> DMG 스테이징 준비"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
cp -R "$BUILD_APP" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

cat > "$STAGING_DIR/처음 실행 시 읽어주세요.txt" <<'EOF'
이 앱은 Apple Developer 인증서로 서명되지 않았습니다.
더블클릭하면 macOS가 실행을 막을 수 있습니다.

처음 한 번만:
1) Todo Buddy.app 을 우클릭(또는 Control+클릭) → "열기" 선택
2) 뜨는 대화상자에서 다시 "열기" 클릭

그 다음부터는 평소처럼 더블클릭으로 열립니다.

터미널을 쓸 수 있다면 아래 명령으로 한 번에 해결할 수도 있습니다:
xattr -cr "/Applications/Todo Buddy.app"
EOF

echo "==> DMG 생성: $DMG_PATH"
rm -f "$DMG_PATH"
hdiutil create -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov -format UDZO \
  "$DMG_PATH"

echo "==> ad-hoc 서명 (DMG 자체)"
codesign --force --sign - "$DMG_PATH"

rm -rf "$STAGING_DIR"

echo "✅ 완료: $DMG_PATH"
