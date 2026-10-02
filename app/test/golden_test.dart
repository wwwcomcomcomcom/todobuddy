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
      final font = File(path).readAsBytesSync().buffer.asByteData();
      for (final family in ['Roboto', 'Apple SD Gothic Neo']) {
        await (FontLoader(family)..addFont(Future.value(font))).load();
      }
    }
    await (FontLoader('MaterialIcons')
          ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
        .load();
  });

  Future<void> openHome(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final server = FakeServer();
    final state = AppState(api: ApiClient(baseUrl: 'http://test.local', client: server.client))
      ..selectedDate = DateTime(2026, 9, 15)
      ..visibleMonth = DateTime(2026, 9);

    tester.view.physicalSize = const Size(1120, 720);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.text('이름만으로 시작하기 (개발용)'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '하루');
    await tester.tap(find.text('시작'));
    await tester.pumpAndSettle();
  }

  testWidgets('메인 화면 골든', (tester) async {
    await openHome(tester);
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/home.png'));
  });

  testWidgets('더블 클릭으로 포커스와 전체 선택이 열린 수정창 골든', (tester) async {
    await openHome(tester);
    final title = find.text('디자인 리뷰 준비');
    await tester.tap(title);
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(title);
    await tester.pumpAndSettle();

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.focusNode!.hasFocus, isTrue);
    expect(field.controller!.selection, const TextSelection(baseOffset: 0, extentOffset: 9));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/todo_editing.png'));
  });
}
