@Tags(['golden'])
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todobuddy_app/api/api_client.dart';
import 'package:todobuddy_app/main.dart';
import 'package:todobuddy_app/state/app_state.dart';

import 'support/fake_server.dart';

/// 메인 화면을 실제 픽셀로 그려 `test/goldens/home.png` 로 남긴다.
/// `flutter test --update-goldens --tags golden` 으로 갱신한다.
void main() {
  setUpAll(() async {
    // 한글이 보이도록 시스템 폰트를 테스트 엔진에 주입한다.
    const path = '/System/Library/Fonts/Supplemental/AppleGothic.ttf';
    if (File(path).existsSync()) {
      final loader = FontLoader('Apple SD Gothic Neo')
        ..addFont(Future.value(File(path).readAsBytesSync().buffer.asByteData()));
      await loader.load();
    }
  });

  testWidgets('메인 화면 골든', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final server = FakeServer();
    final state = AppState(api: ApiClient(baseUrl: 'http://test.local', client: server.client));

    tester.view.physicalSize = const Size(1440, 960);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.text('이름만으로 시작하기 (개발용)'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '집가고싶다');
    await tester.tap(find.text('시작'));
    await tester.pumpAndSettle();

    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/home.png'));
  });
}
