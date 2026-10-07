import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:todobuddy_app/screens/settings_screen.dart';
import 'package:todobuddy_app/services/startup_service.dart';
import 'package:todobuddy_app/state/app_state.dart';
import 'package:todobuddy_app/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('todobuddy/startup');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late AppState state;
  late List<MethodCall> calls;
  late String osStatus;
  bool failReads = false;
  bool failWrites = false;
  bool approvalRequired = false;
  Completer<void>? pendingWrite;

  setUp(() {
    state = AppState();
    calls = [];
    osStatus = 'disabled';
    failReads = false;
    failWrites = false;
    approvalRequired = false;
    pendingWrite = null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      switch (call.method) {
        case 'getStatus':
          if (failReads) throw PlatformException(code: 'read_failed');
          return osStatus;
        case 'setEnabled':
          if (pendingWrite != null) await pendingWrite!.future;
          if (failWrites) throw PlatformException(code: 'write_failed');
          osStatus = call.arguments == true
              ? (approvalRequired ? 'requiresApproval' : 'enabled')
              : 'disabled';
          return osStatus;
        case 'openSettings':
          return null;
        default:
          throw MissingPluginException();
      }
    });
  });

  tearDown(() {
    state.dispose();
    messenger.setMockMethodCallHandler(channel, null);
    debugDefaultTargetPlatformOverride = null;
  });

  Future<void> showSettings(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: buildAppTheme(),
          home: const SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  for (final platform in [TargetPlatform.macOS, TargetPlatform.windows]) {
    test('$platform: 등록과 해제를 OS에 요청하고 반환된 상태를 사용한다', () async {
      debugDefaultTargetPlatformOverride = platform;
      await state.refreshStartupStatus();
      expect(state.startupStatus, StartupStatus.disabled);
      expect(calls.map((call) => call.method), ['getStatus']);

      await state.setStartupEnabled(true);
      expect(state.startupStatus, StartupStatus.enabled);
      await state.setStartupEnabled(false);
      expect(state.startupStatus, StartupStatus.disabled);
      expect(
        calls
            .where((call) => call.method == 'setEnabled')
            .map((call) => call.arguments),
        [true, false],
      );
      expect(state.startupError, isNull);
    });
  }

  test('지원하지 않는 OS에서는 네이티브 채널을 호출하지 않는다', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    final service = StartupService();
    expect(await service.getStatus(), StartupStatus.unsupported);
    expect(await service.setEnabled(true), StartupStatus.unsupported);
    await service.openSettings();
    expect(calls, isEmpty);
  });

  test('쓰기 실패 시 실제 OS 상태를 다시 읽고 오류를 남긴다', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.macOS;
    await state.refreshStartupStatus();
    osStatus = 'enabled'; // Another process changed the setting.
    failWrites = true;
    await state.setStartupEnabled(false);
    expect(state.startupStatus, StartupStatus.enabled);
    expect(state.startupError, contains('바꾸지 못했어요'));
    expect(state.startupBusy, isFalse);
  });

  test('쓰기와 재조회가 모두 실패하면 확정되지 않은 값을 표시하지 않는다', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.macOS;
    await state.refreshStartupStatus();
    failReads = true;
    failWrites = true;
    await state.setStartupEnabled(true);
    expect(state.startupStatus, isNull);
    expect(state.startupError, isNotNull);
    expect(state.startupBusy, isFalse);
  });

  test('알 수 없는 네이티브 응답은 꺼짐으로 오인하지 않는다', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.macOS;
    osStatus = 'unexpected';
    await state.refreshStartupStatus();
    expect(state.startupStatus, isNull);
    expect(state.startupError, isNotNull);
  });

  test('설정 변경 중에는 중복 요청과 상태 재조회를 막는다', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.macOS;
    pendingWrite = Completer<void>();
    final operation = state.setStartupEnabled(true);
    await state.setStartupEnabled(false);
    await state.refreshStartupStatus();
    expect(state.startupBusy, isTrue);
    pendingWrite!.complete();
    await operation;
    expect(calls.map((call) => call.method), ['setEnabled']);
    expect(state.startupStatus, StartupStatus.enabled);
  });

  testWidgets('설정을 열 때 자동 등록하지 않으며 스위치로 등록과 해제가 가능하다', (tester) async {
    await showSettings(tester);
    expect(calls.map((call) => call.method), ['getStatus']);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isFalse,
    );

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(osStatus, 'enabled');
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isTrue,
    );

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(osStatus, 'disabled');
  }, variant: TargetPlatformVariant.only(TargetPlatform.macOS));

  testWidgets('승인이 필요한 경우 시스템 설정으로 안내하고 등록 취소도 가능하다', (tester) async {
    approvalRequired = true;
    await showSettings(tester);
    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(state.startupStatus, StartupStatus.requiresApproval);
    expect(find.textContaining('아직 허용되지 않았어요'), findsOneWidget);

    await tester.tap(find.text('시스템 설정 열기'));
    await tester.pumpAndSettle();
    expect(calls.last.method, 'openSettings');

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(osStatus, 'disabled');
    expect(find.text('시스템 설정 열기'), findsNothing);
  }, variant: TargetPlatformVariant.only(TargetPlatform.macOS));

  testWidgets('운영체제에서 설정을 변경하고 돌아오면 상태를 갱신한다', (tester) async {
    osStatus = 'enabled';
    await showSettings(tester);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    osStatus = 'requiresApproval';
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.text('시스템 설정 열기'), findsOneWidget);
    expect(state.startupStatus, StartupStatus.requiresApproval);
  }, variant: TargetPlatformVariant.only(TargetPlatform.macOS));

  testWidgets('조회 오류를 표시하고 재시도하면 회복한다', (tester) async {
    failReads = true;
    await showSettings(tester);
    expect(find.textContaining('불러오지 못했어요'), findsOneWidget);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
      isNull,
    );

    failReads = false;
    osStatus = 'enabled';
    await tester.tap(find.text('다시 시도'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isTrue,
    );
    expect(find.text('다시 시도'), findsNothing);
    expect(tester.takeException(), isNull);
  }, variant: TargetPlatformVariant.only(TargetPlatform.macOS));

  testWidgets('설정 요청 도중 화면을 닫아도 오류가 나지 않는다', (tester) async {
    await showSettings(tester);
    pendingWrite = Completer<void>();
    await tester.tap(find.byType(SwitchListTile));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    pendingWrite!.complete();
    await tester.pumpAndSettle();
    expect(state.startupStatus, StartupStatus.enabled);
    expect(tester.takeException(), isNull);
  }, variant: TargetPlatformVariant.only(TargetPlatform.macOS));
}
