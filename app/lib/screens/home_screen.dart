import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/update_checker.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/month_calendar.dart';
import '../widgets/profile_card.dart';
import '../widgets/scope_bar.dart';
import '../widgets/todo_column.dart';
import '../widgets/update_dialog.dart';
import 'category_form_screen.dart';
import 'category_manage_screen.dart';
import 'people_screen.dart';
import 'routine_form_screen.dart';
import 'routine_manage_screen.dart';
import 'settings_screen.dart';
import 'todomate_import_screen.dart';

/// 메인 화면: 왼쪽에 프로필·캘린더, 오른쪽에 TODO 리스트.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  // 800px 데스크탑 창에서도 양쪽 패딩을 제외한 영역에 두 열이 들어간다.
  static const _breakpoint = 720.0;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final board = state.board;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: ScopeBar(onManagePeople: () => _push(context, const PeopleScreen()))),
                  const SizedBox(width: 8),
                  SizedBox(width: 36, height: 36, child: _MainMenuButton()),
                ],
              ),
              if (state.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(state.errorMessage!,
                      style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
                ),
              const SizedBox(height: 20),
              Expanded(
                child: board == null
                    ? Center(
                        child: state.loadingBoard
                            ? const CircularProgressIndicator(color: AppColors.ink)
                            : const Text('불러올 내용이 없어요', style: TextStyle(color: AppColors.subtle)),
                      )
                    : LayoutBuilder(
                        builder: (context, constraints) {
                          final left = _LeftPane(profileEditable: state.isOwnScope);
                          final right = TodoColumn(
                            board: board,
                            onManageCategories: () => _push(context, const CategoryManageScreen()),
                          );

                          if (constraints.maxWidth < _breakpoint) {
                            return ListView(
                              children: [
                                left,
                                const SizedBox(height: 32),
                                SizedBox(height: 420, child: right),
                              ],
                            );
                          }
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: (constraints.maxWidth * 0.4).clamp(320.0, 380.0),
                                child: SingleChildScrollView(child: left),
                              ),
                              const SizedBox(width: 36),
                              Expanded(child: right),
                            ],
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void _push(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen))
        .then((_) => context.mounted ? context.read<AppState>().refreshAll() : null);
  }
}

class _LeftPane extends StatelessWidget {
  const _LeftPane({required this.profileEditable});

  final bool profileEditable;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final board = state.board!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileCard(profile: board.profile, editable: profileEditable),
        const SizedBox(height: 24),
        MonthCalendar(
          month: state.visibleMonth,
          selectedDate: state.selectedDate,
          segmentsByDate: state.calendar,
          onSelectDate: state.selectDate,
          onChangeMonth: state.showMonth,
        ),
      ],
    );
  }
}

/// 우상단 햄버거 메뉴.
class _MainMenuButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();

    return PopupMenuButton<String>(
      icon: const Icon(Icons.menu_rounded, size: 22),
      padding: EdgeInsets.zero,
      tooltip: '메뉴',
      position: PopupMenuPosition.under,
      onSelected: (value) async {
        switch (value) {
          case 'create':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const CategoryFormScreen()));
          case 'manage':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const CategoryManageScreen()));
          case 'routine_create':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const RoutineFormScreen()));
          case 'routine_manage':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const RoutineManageScreen()));
          case 'people':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const PeopleScreen()));
          case 'today':
            await state.selectDate(DateTime.now());
          case 'import_todomate':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const TodoMateImportScreen()));
          case 'check_update':
            await _checkForUpdateManually(context);
            return;
          case 'settings':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
            return;
          case 'signout':
            await state.signOut();
            return;
        }
        await state.refreshAll();
      },
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: 'routine_create',
          child: ListTile(contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.repeat_rounded), title: Text('반복 일정 추가')),
        ),
        PopupMenuItem(
          value: 'routine_manage',
          child: ListTile(contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.event_repeat_rounded), title: Text('반복 일정 관리')),
        ),
        PopupMenuDivider(),
        PopupMenuItem(
          value: 'create',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.add_box_outlined),
            title: Text('카테고리 등록'),
          ),
        ),
        PopupMenuItem(
          value: 'manage',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.tune_rounded),
            title: Text('카테고리 관리'),
          ),
        ),
        PopupMenuDivider(),
        PopupMenuItem(
          value: 'people',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.people_alt_outlined),
            title: Text('친구 · 크루'),
          ),
        ),
        PopupMenuItem(
          value: 'today',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.today_rounded),
            title: Text('오늘로 이동'),
          ),
        ),
        PopupMenuDivider(),
        PopupMenuItem(
          value: 'import_todomate',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.move_down_rounded),
            title: Text('투두메이트에서 가져오기'),
          ),
        ),
        PopupMenuItem(
          value: 'check_update',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.system_update_alt_rounded),
            title: Text('업데이트 확인'),
          ),
        ),
        PopupMenuDivider(),
        PopupMenuItem(
          value: 'settings',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.settings_outlined),
            title: Text('앱 설정'),
          ),
        ),
        PopupMenuItem(
          value: 'signout',
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.logout_rounded),
            title: Text('로그아웃'),
          ),
        ),
      ],
    );
  }
}

Future<void> _checkForUpdateManually(BuildContext context) async {
  final info = await UpdateChecker().checkForUpdate();
  if (!context.mounted) return;
  if (info != null) {
    await showUpdateAvailableDialog(context, info);
  } else {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('최신 버전이에요.')));
  }
}
