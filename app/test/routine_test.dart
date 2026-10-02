import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todobuddy_app/api/api_client.dart';
import 'package:todobuddy_app/main.dart';
import 'package:todobuddy_app/screens/routine_form_screen.dart';
import 'package:todobuddy_app/state/app_state.dart';

import 'support/routine_server.dart';

void main() {
  late RoutineServer mock;
  late AppState state;

  setUp(() {
    SharedPreferences.setMockInitialValues({'todobuddy.token': 'test-token'});
    mock = RoutineServer();
    state =
        AppState(
            api: ApiClient(
              baseUrl: 'http://test.local',
              client: mock.server.client,
            ),
          )
          ..selectedDate = DateTime(2026, 10, 2)
          ..visibleMonth = DateTime(2026, 10);
  });

  Future<void> open(
    WidgetTester tester,
    String menu, {
    Size size = const Size(1120, 900),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.menu_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.text(menu));
    await tester.pumpAndSettle();
  }

  Future<void> tapInForm(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(
      finder.hitTestable(),
      180,
      scrollable: find
          .descendant(
            of: find.byType(ListView).last,
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(finder.hitTestable());
    await tester.pumpAndSettle();
  }

  testWidgets('햄버거 메뉴에서 월별 둘째 월요일을 종료일 없이 저장한다', (tester) async {
    await open(tester, '반복 일정 추가');
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '책 읽기');
    await tester.tap(find.text('개월마다').first);
    await tester.pumpAndSettle();
    await tapInForm(tester, find.text('몇째 요일'));
    await tapInForm(tester, find.widgetWithText(FilterChip, '첫째'));
    await tapInForm(tester, find.widgetWithText(FilterChip, '둘째'));
    await tapInForm(tester, find.widgetWithText(FilterChip, '금'));
    await tapInForm(tester, find.widgetWithText(FilterChip, '월'));
    await tester.tap(find.widgetWithText(TextButton, '저장'));
    await tester.pumpAndSettle();
    expect(find.byType(RoutineFormScreen), findsNothing);
    expect(mock.writes, hasLength(1));
    final body = jsonDecode(mock.writes.single.body) as Map<String, dynamic>;
    expect(body['endDate'], isNull);
    expect(body['categoryId'], 1);
    expect(body['rule'], {
      'frequency': 'monthly',
      'interval': 1,
      'monthMode': 'weekdays',
      'ordinals': [2],
      'weekdays': [1],
    });
    expect(tester.takeException(), isNull);
  });

  testWidgets('미리보기 계산 중에는 저장할 수 없고 실패하면 입력을 유지한다', (tester) async {
    await open(tester, '반복 일정 추가');
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '산책');
    final gate = Completer<void>();
    mock.previewDelay = gate.future;
    await tester.enterText(find.byKey(const ValueKey('routine-interval')), '2');
    await tester.pump(const Duration(milliseconds: 350));
    expect(
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, '저장'))
          .onPressed,
      isNull,
    );
    gate.complete();
    await tester.pumpAndSettle();
    mock.failSave = true;
    await tester.tap(find.widgetWithText(TextButton, '저장'));
    await tester.pumpAndSettle();
    expect(find.byType(RoutineFormScreen), findsOneWidget);
    expect(
      tester
          .widget<TextField>(find.byKey(const ValueKey('routine-title')))
          .controller!
          .text,
      '산책',
    );
    await tester.scrollUntilVisible(
      find.text('저장 실패 테스트'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('저장 실패 테스트'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('요일을 모두 해제하면 저장을 막고 오류를 표시한다', (tester) async {
    await open(tester, '반복 일정 추가');
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '운동');
    await tester.tap(find.text('주마다').first);
    await tester.pumpAndSettle();
    await tapInForm(tester, find.widgetWithText(FilterChip, '금'));
    expect(
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, '저장'))
          .onPressed,
      isNull,
    );
    expect(mock.writes, isEmpty);
  });

  testWidgets('이전 설정의 느린 미리보기 응답은 최신 설정을 덮어쓰지 않는다', (tester) async {
    await open(tester, '반복 일정 추가');
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '산책');
    final gate = Completer<void>();
    mock.previewDelay = gate.future;
    await tester.enterText(find.byKey(const ValueKey('routine-interval')), '0');
    await tester.pump(const Duration(milliseconds: 350));
    mock.previewDelay = null;
    await tester.enterText(find.byKey(const ValueKey('routine-interval')), '2');
    await tester.pumpAndSettle();
    gate.complete();
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextButton>(find.widgetWithText(TextButton, '저장'))
          .onPressed,
      isNotNull,
    );
    await tester.tap(find.widgetWithText(TextButton, '저장'));
    await tester.pumpAndSettle();
    expect(
      (jsonDecode(mock.writes.single.body)
          as Map<String, dynamic>)['rule']['interval'],
      2,
    );
  });

  testWidgets('종료일 선택기에서 고른 날짜를 저장한다', (tester) async {
    await open(tester, '반복 일정 추가');
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '산책');
    await tapInForm(tester, find.text('종료일 없음'));
    await tapInForm(tester, find.text('종료일 (이 날짜까지 포함)'));
    await tester.tap(
      find.descendant(
        of: find.byType(DatePickerDialog),
        matching: find.text('10'),
      ),
    );
    await tester.tap(find.text('선택'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, '저장'));
    await tester.pumpAndSettle();
    expect(
      (jsonDecode(mock.writes.single.body) as Map<String, dynamic>)['endDate'],
      '2026-10-10',
    );
  });

  testWidgets('삭제 기본값은 과거와 오늘 보존이며 선택한 옵션만 전송한다', (tester) async {
    mock.routines.add(RoutineServer.sample());
    await open(tester, '반복 일정 관리', size: const Size(800, 600));
    await tester.tap(find.byTooltip('반복 일정 삭제'));
    await tester.pumpAndSettle();
    final boxes = tester
        .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
        .toList();
    expect(boxes.map((b) => b.value), [true, true, false]);
    await tester.tap(find.text('과거 완료 일정 유지 (3개)'));
    await tester.tap(find.text('오늘 일정도 삭제 (1개)'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '반복 일정 삭제'));
    await tester.pumpAndSettle();
    expect(mock.writes.single.method, 'DELETE');
    expect(jsonDecode(mock.writes.single.body), {
      'asOfDate': '2026-10-02',
      'keepPastDone': false,
      'keepPastUndone': true,
      'removeToday': true,
    });
    expect(find.text('아직 반복 일정이 없어요.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('수정 화면은 기존 세부 규칙을 유지하고 버전을 함께 보낸다', (tester) async {
    mock.routines.add(RoutineServer.sample());
    await open(tester, '반복 일정 관리');
    await tester.tap(find.byTooltip('반복 일정 편집'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('routine-title')), '새 이름');
    await tester.tap(find.widgetWithText(TextButton, '저장'));
    await tester.pumpAndSettle();
    final body = jsonDecode(mock.writes.single.body) as Map<String, dynamic>;
    expect(mock.writes.single.method, 'PATCH');
    expect(body['versionId'], 1);
    expect(body['rule'], RoutineServer.sample()['rule']);
    expect(body['title'], '새 이름');
  });

  testWidgets('좁은 창에서도 월별 날짜와 종료일 설정을 스크롤해 접근한다', (tester) async {
    await open(tester, '반복 일정 추가', size: const Size(390, 700));
    await tester.tap(find.text('개월마다').first);
    await tester.pumpAndSettle();
    await tapInForm(tester, find.widgetWithText(FilterChip, '마지막 날'));
    expect(
      tester
          .widget<FilterChip>(find.widgetWithText(FilterChip, '마지막 날'))
          .selected,
      isTrue,
    );
    await tapInForm(tester, find.text('종료일 없음'));
    await tester.scrollUntilVisible(
      find.text('종료일 (이 날짜까지 포함)'),
      160,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('종료일 (이 날짜까지 포함)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
