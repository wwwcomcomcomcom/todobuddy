import 'dart:async';
import 'dart:convert';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todobuddy_app/api/api_client.dart';
import 'package:todobuddy_app/main.dart';
import 'package:todobuddy_app/state/app_state.dart';

import 'support/fake_server.dart';

void main() {
  late FakeServer server;
  late AppState state;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    state = AppState(api: ApiClient(baseUrl: 'http://test.local', client: server.client))
      ..selectedDate = DateTime(2026, 9, 15)
      ..visibleMonth = DateTime(2026, 9);
  });

  Future<void> signIn(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1120, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();
    await tester.tap(find.text('이름만으로 시작하기 (개발용)'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '하루');
    await tester.tap(find.text('시작'));
    await tester.pumpAndSettle();
  }

  Future<void> compose(WidgetTester tester, String title, {int categoryIndex = 0}) async {
    await tester.tap(find.byIcon(Icons.add_rounded).at(categoryIndex));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), title);
  }

  Future<void> clickOutside(WidgetTester tester) async {
    await tester.tap(find.text('프로필에 자기소개를 입력해보세요'));
    await tester.pumpAndSettle();
  }

  Future<void> doubleClick(WidgetTester tester, Offset position) async {
    await tester.tapAt(position);
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tapAt(position);
    await tester.pumpAndSettle();
  }

  Map<String, dynamic> writeBody(int index) => jsonDecode(server.todoWrites[index].body) as Map<String, dynamic>;

  for (final longTitle in [false, true]) {
    testWidgets('${longTitle ? '여러 줄' : '한 줄'} 할 일은 호버와 수정 포커스 전환 시 행 높이와 간격을 유지한다', (tester) async {
      final title = longTitle ? '회의 자료 정리와 발표 준비 및 다음 주 업무 계획 확인을 모두 마무리하기' : '디자인 리뷰 준비';
      (server.board['categories'] as List)[1]['todos'][0]['title'] = title;
      await signIn(tester);
      if (longTitle) {
        tester.view.physicalSize = const Size(800, 600);
        await tester.pumpAndSettle();
      }

      final titleFinder = find.text(title);
      final row = find.ancestor(of: titleFinder, matching: find.byType(Row)).first;
      final surroundings = [row, titleFinder, find.text('혼자 하는 일'), find.text('러닝 30분')];
      final before = surroundings.map(tester.getRect).toList();
      final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
      await mouse.addPointer(location: Offset.zero);
      addTearDown(mouse.removePointer);

      await mouse.moveTo(tester.getCenter(titleFinder));
      await tester.pumpAndSettle();
      expect(find.byTooltip('이름 바꾸기').hitTestable(), findsOneWidget);
      expect(surroundings.map(tester.getRect).toList(), before);

      await mouse.moveTo(tester.getCenter(find.text('프로필에 자기소개를 입력해보세요')));
      await tester.pumpAndSettle();
      expect(find.byTooltip('이름 바꾸기').hitTestable(), findsNothing);
      expect(surroundings.map(tester.getRect).toList(), before);

      await mouse.moveTo(tester.getCenter(titleFinder));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('이름 바꾸기').hitTestable());
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(find.byType(TextField)).focusNode!.hasFocus, isTrue);
      final editingRow = find.ancestor(of: find.byType(TextField), matching: find.byType(Row)).first;
      expect(tester.getRect(editingRow), before[0]);
      expect(tester.getRect(find.text('혼자 하는 일')), before[2]);
      expect(tester.getRect(find.text('러닝 30분')), before[3]);
      await tester.tap(find.descendant(of: editingRow, matching: find.byIcon(Icons.close_rounded)));
      await tester.pumpAndSettle();
      expect(surroundings.map(tester.getRect).toList(), before);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('새 할 일은 바깥 클릭으로 저장되고 입력창이 닫힌다', (tester) async {
    await signIn(tester);
    final todoRow = find.ancestor(of: find.text('주간 보고서 쓰기'), matching: find.byType(Row)).first;
    final rowHeight = tester.getSize(todoRow).height;
    await compose(tester, '  책 읽기  ');
    final inputRow = find.ancestor(of: find.byType(TextField), matching: find.byType(Row)).first;
    expect(tester.getSize(inputRow).height, rowHeight);
    await clickOutside(tester);

    expect(server.todoWrites, hasLength(1));
    expect(server.todoWrites.single.method, 'POST');
    expect(writeBody(0), {'categoryId': 1, 'date': '2026-09-15', 'title': '책 읽기'});
    expect(find.text('책 읽기'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Enter 저장 후에는 빈 입력창과 포커스를 유지해 연속 추가한다', (tester) async {
    await signIn(tester);
    await compose(tester, '첫 번째 할 일');
    final controller = tester.widget<TextField>(find.byType(TextField)).controller;
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller, same(controller));
    expect(field.controller!.text, isEmpty);
    expect(field.focusNode!.hasFocus, isTrue);
    expect(find.text('첫 번째 할 일'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '두 번째 할 일');
    await clickOutside(tester);
    expect(server.todoWrites, hasLength(2));
    expect(writeBody(1)['title'], '두 번째 할 일');
    expect(find.text('두 번째 할 일'), findsOneWidget);
  });

  for (final clickBlankArea in [false, true]) {
    testWidgets('기존 할 일 ${clickBlankArea ? '글자 옆 빈 영역' : '글자 영역'}을 더블 클릭하면 선택된 수정창이 열린다', (tester) async {
      await signIn(tester);
      final title = find.text('디자인 리뷰 준비');
      final rowBefore = tester.getRect(find.ancestor(of: title, matching: find.byType(Row)).first);
      final nextTodoBefore = tester.getRect(find.text('러닝 30분'));
      final position = clickBlankArea
          ? Offset(tester.getRect(find.ancestor(of: title, matching: find.byType(Row)).first).right - 80,
              tester.getCenter(title).dy)
          : tester.getCenter(title);
      await doubleClick(tester, position);

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(tester.getRect(find.ancestor(of: find.byType(TextField), matching: find.byType(Row)).first), rowBefore);
      expect(tester.getRect(find.text('러닝 30분')), nextTodoBefore);
      expect(field.focusNode!.hasFocus, isTrue);
      expect(field.controller!.text, '디자인 리뷰 준비');
      expect(field.controller!.selection, const TextSelection(baseOffset: 0, extentOffset: 9));
      await tester.enterText(find.byType(TextField), '디자인 리뷰 마무리');
      await clickOutside(tester);

      expect(server.todoWrites, hasLength(1));
      expect(server.todoWrites.single.method, 'PATCH');
      expect(server.todoWrites.single.url.path, '/todos/11');
      expect(writeBody(0), {'title': '디자인 리뷰 마무리'});
      expect(find.text('디자인 리뷰 마무리'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });
  }

  testWidgets('기존 할 일 수정은 Enter로도 저장하고 닫는다', (tester) async {
    await signIn(tester);
    await doubleClick(tester, tester.getCenter(find.text('러닝 30분')));
    await tester.enterText(find.byType(TextField), '러닝 40분');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(writeBody(0), {'title': '러닝 40분'});
    expect(find.text('러닝 40분'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('빈 입력의 바깥 클릭과 닫기 버튼은 저장하지 않는다', (tester) async {
    await signIn(tester);
    await compose(tester, '   ');
    await clickOutside(tester);
    expect(find.byType(TextField), findsNothing);

    await compose(tester, '저장하지 않을 새 할 일');
    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNothing);

    await doubleClick(tester, tester.getCenter(find.text('디자인 리뷰 준비')));
    await tester.enterText(find.byType(TextField), '저장하지 않을 수정');
    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(server.todoWrites, isEmpty);
    expect(find.text('디자인 리뷰 준비'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('Enter 저장 중 바깥 클릭은 중복 저장하거나 포커스를 되돌리지 않는다', (tester) async {
    await signIn(tester);
    final pendingWrite = Completer<void>();
    server.todoWriteDelay = pendingWrite.future;
    addTearDown(() {
      if (!pendingWrite.isCompleted) pendingWrite.complete();
    });
    await compose(tester, '한 번만 저장');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(tester.widget<TextField>(find.byType(TextField)).readOnly, isTrue);
    await clickOutside(tester);
    expect(find.byType(TextField), findsNothing);

    pendingWrite.complete();
    await tester.pumpAndSettle();
    expect(server.todoWrites, hasLength(1));
    expect(find.text('한 번만 저장'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('다른 카테고리의 추가 버튼을 누르면 이전 입력을 저장하고 새 입력에 포커스를 준다', (tester) async {
    await signIn(tester);
    await compose(tester, '회사 할 일');
    await tester.tap(find.byIcon(Icons.add_rounded).at(1));
    await tester.pumpAndSettle();

    expect(writeBody(0)['categoryId'], 1);
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller!.text, isEmpty);
    expect(field.focusNode!.hasFocus, isTrue);

    await tester.enterText(find.byType(TextField), '개인 할 일');
    await clickOutside(tester);
    expect(writeBody(1)['categoryId'], 2);
    expect(find.text('회사 할 일'), findsOneWidget);
    expect(find.text('개인 할 일'), findsOneWidget);
  });

  testWidgets('읽기 전용 카테고리의 할 일은 더블 클릭해도 수정창을 열지 않는다', (tester) async {
    for (final category in server.board['categories'] as List) {
      category['editable'] = false;
    }
    await signIn(tester);
    await doubleClick(tester, tester.getCenter(find.text('디자인 리뷰 준비')));

    expect(find.byType(TextField), findsNothing);
    expect(server.todoWrites, isEmpty);
  });
}
