import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:todobuddy_app/api/api_client.dart';
import 'package:todobuddy_app/main.dart';
import 'package:todobuddy_app/state/app_state.dart';
import 'package:todobuddy_app/widgets/month_calendar.dart';

import 'support/fake_server.dart';

void main() {
  late FakeServer server;
  late AppState state;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    server = FakeServer();
    state = AppState(api: ApiClient(baseUrl: 'http://test.local', client: server.client));
  });

  /// 개발용 로그인을 거쳐 메인 화면까지 진입시킨다.
  Future<void> signIn(WidgetTester tester) async {
    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();

    await tester.tap(find.text('이름만으로 시작하기 (개발용)'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '집가고싶다');
    await tester.tap(find.text('시작'));
    await tester.pumpAndSettle();
  }

  testWidgets('로그인 화면은 서버 설정에 맞는 버튼만 보여준다', (tester) async {
    await tester.pumpWidget(TodoBuddyApp(state: state));
    await tester.pumpAndSettle();

    expect(find.text('TodoBuddy'), findsOneWidget);
    expect(find.text('이름만으로 시작하기 (개발용)'), findsOneWidget);
    // googleEnabled:false 이므로 구글 버튼은 숨는다.
    expect(find.text('Google 계정으로 로그인'), findsNothing);
  });

  testWidgets('로그인하면 프로필·캘린더·TODO 가 한 화면에 그려진다', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await signIn(tester);

    // 상단 스코프 칩: 나 · 크루 · 친구
    expect(find.text('더모먼트'), findsOneWidget);
    expect(find.text('서연'), findsOneWidget);

    // 왼쪽: 프로필과 캘린더
    expect(find.text('프로필에 자기소개를 입력해보세요'), findsOneWidget);
    expect(find.textContaining('년 '), findsOneWidget);
    expect(find.text('월'), findsOneWidget);

    // 오른쪽: 카테고리와 TODO
    expect(find.text('일하는척 하기 위한 카테고리'), findsOneWidget);
    expect(find.text('개인적으로 할일'), findsOneWidget);
    expect(find.text('OCR 개선판 만들기'), findsOneWidget);
    expect(find.text('Velog 글쓰기'), findsOneWidget);

    expect(server.requests, contains('GET /board'));
    expect(server.requests, contains('GET /board/calendar'));
  });

  testWidgets('체크박스를 누르면 서버에 완료 상태를 보낸다', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await signIn(tester);
    server.requests.clear();

    // 'Velog 글쓰기' 행의 체크박스(텍스트 왼쪽의 스퀘어클)를 누른다.
    final row = find.ancestor(of: find.text('Velog 글쓰기'), matching: find.byType(Row)).first;
    await tester.tap(find.descendant(of: row, matching: find.byType(GestureDetector)).first);
    await tester.pumpAndSettle();

    expect(server.requests.any((r) => r.startsWith('PATCH /todos/11')), isTrue);
  });

  testWidgets('크루 칩을 누르면 그 크루 스코프로 보드를 다시 읽는다', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await signIn(tester);
    await tester.tap(find.text('더모먼트'));
    await tester.pumpAndSettle();

    expect(state.scope, 'crew:1');
  });

  testWidgets('메뉴에서 카테고리 등록 화면으로 갈 수 있다', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await signIn(tester);
    await tester.tap(find.byIcon(Icons.menu_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.text('카테고리 등록'));
    await tester.pumpAndSettle();

    expect(find.text('카테고리 입력'), findsOneWidget);
    expect(find.text('공개설정'), findsOneWidget);
    expect(find.text('나만 보기'), findsOneWidget);
    expect(find.text('색상'), findsOneWidget);
  });

  testWidgets('캘린더 날짜 칸은 카테고리 색으로 칠해진다', (tester) async {
    tester.view.physicalSize = const Size(1400, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await signIn(tester);

    // 가짜 서버가 2026-09-15 에 빨강·노랑 두 카테고리를 돌려준다.
    Finder band(Color color) => find.descendant(
          of: find.byType(MonthCalendar),
          matching: find.byWidgetPredicate(
            (w) => w is ColoredBox && w.color.toARGB32() == color.toARGB32(),
          ),
        );

    expect(band(const Color(0xFFEE8B8B)), findsOneWidget);
    expect(band(const Color(0xFFF5C543)), findsOneWidget);
    // 너비가 0 으로 접히면 색이 보이지 않으므로 실제 크기까지 확인한다.
    expect(tester.getSize(band(const Color(0xFFEE8B8B))).width, greaterThan(20));
    expect(tester.getSize(band(const Color(0xFFF5C543))).height, greaterThan(10));
  });
}
