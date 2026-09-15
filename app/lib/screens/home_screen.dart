import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/month_calendar.dart';
import '../widgets/profile_card.dart';
import '../widgets/scope_bar.dart';
import '../widgets/todo_column.dart';
import 'category_form_screen.dart';
import 'category_manage_screen.dart';
import 'people_screen.dart';

/// 메인 화면: 왼쪽에 프로필·캘린더, 오른쪽에 TODO 리스트.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  static const _breakpoint = 900.0;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final board = state.board;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 12, 28, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: ScopeBar(onManagePeople: () => _push(context, const PeopleScreen()))),
                  const SizedBox(width: 8),
                  _MainMenuButton(),
                ],
              ),
              if (state.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(state.errorMessage!,
                      style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
                ),
              const SizedBox(height: 24),
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
                              Expanded(flex: 6, child: SingleChildScrollView(child: left)),
                              const SizedBox(width: 48),
                              Expanded(flex: 5, child: right),
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
        const SizedBox(height: 32),
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
      icon: const Icon(Icons.menu_rounded, size: 26),
      tooltip: '메뉴',
      position: PopupMenuPosition.under,
      onSelected: (value) async {
        switch (value) {
          case 'create':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const CategoryFormScreen()));
          case 'manage':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const CategoryManageScreen()));
          case 'people':
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const PeopleScreen()));
          case 'today':
            await state.selectDate(DateTime.now());
          case 'signout':
            await state.signOut();
            return;
        }
        await state.refreshAll();
      },
      itemBuilder: (context) => const [
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
