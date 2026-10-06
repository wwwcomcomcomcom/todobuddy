import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../services/todomate_client.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/todo_column.dart';

enum _Step { login, range, preview }

/// 투두메이트 계정에서 일정을 가져와 TodoBuddy 로 옮기는 3단계 화면.
/// 로그인 → 가져올 기간 → 미리보기(확인) 순서로 진행한다.
class TodoMateImportScreen extends StatefulWidget {
  const TodoMateImportScreen({super.key});

  @override
  State<TodoMateImportScreen> createState() => _TodoMateImportScreenState();
}

class _TodoMateImportScreenState extends State<TodoMateImportScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _client = TodoMateClient();

  late final DateTime _today = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);
  late final DateTime _earliestBound = _today.subtract(const Duration(days: 30));
  late final DateTime _latestBound = _today.add(const Duration(days: 365));
  late DateTime _rangeStart = _today.subtract(const Duration(days: 7));
  late DateTime _rangeEnd = _today.add(const Duration(days: 30));

  _Step _step = _Step.login;
  bool _busy = false;
  String? _error;

  List<TodoMateCategory> _preview = const [];
  final Map<String, CategoryVisibility> _visibility = {};

  int _importedCount = 0;
  int _importTotal = 0;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _goBack() {
    switch (_step) {
      case _Step.login:
        Navigator.pop(context);
      case _Step.range:
        setState(() => _step = _Step.login);
      case _Step.preview:
        setState(() => _step = _Step.range);
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on TodoMateException catch (e) {
      setState(() => _error = e.message);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '처리하지 못했어요: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _login() => _run(() async {
        await _client.signIn(_email.text.trim(), _password.text);
        if (mounted) setState(() => _step = _Step.range);
      });

  Future<void> _loadPreview() => _run(() async {
        final result = await _client.fetchSchedules(start: _rangeStart, end: _rangeEnd);
        if (!mounted) return;
        setState(() {
          _preview = result;
          _visibility
            ..clear()
            ..addEntries(result.map((c) => MapEntry(
                  c.name,
                  c.isPrivate ? CategoryVisibility.private : CategoryVisibility.public,
                )));
          _step = _Step.preview;
        });
      });

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _rangeStart : _rangeEnd,
      firstDate: _earliestBound,
      lastDate: _latestBound,
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _rangeStart = picked;
        if (_rangeEnd.isBefore(_rangeStart)) _rangeEnd = _rangeStart;
      } else {
        _rangeEnd = picked;
        if (_rangeStart.isAfter(_rangeEnd)) _rangeStart = _rangeEnd;
      }
    });
  }

  Future<void> _confirmImport() => _run(() async {
        final api = context.read<AppState>().api;
        final existing = await api.categories();
        final byName = {for (final c in existing) c.name: c.id};

        _importTotal = _preview.fold(0, (sum, c) => sum + c.todos.length);
        _importedCount = 0;
        if (mounted) setState(() {});

        for (final category in _preview) {
          var categoryId = byName[category.name];
          if (categoryId == null) {
            final created = await api.createCategory(
              name: category.name,
              color: colorToHex(_androidColorToColor(category.androidColor)),
              visibility: _visibility[category.name] ?? CategoryVisibility.private,
            );
            categoryId = created.id;
            byName[category.name] = categoryId;
          }
          for (final todo in category.todos) {
            if (todo.title.isEmpty) continue;
            final created = await api.createTodo(categoryId: categoryId, date: ymd(todo.date), title: todo.title);
            if (todo.completed) await api.updateTodo(created.id, done: true);
            _importedCount++;
            if (mounted) setState(() {});
          }
        }

        if (!mounted) return;
        await context.read<AppState>().refreshAll();
        if (!mounted) return;
        Navigator.pop(context);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$_importTotal건의 할 일을 가져왔어요.')));
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: _busy ? null : _goBack,
        ),
        title: Text(switch (_step) {
          _Step.login => '투두메이트 로그인',
          _Step.range => '가져올 기간',
          _Step.preview => '가져오기 미리보기',
        }, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ),
      body: switch (_step) {
        _Step.login => _LoginForm(
            email: _email,
            password: _password,
            busy: _busy,
            error: _error,
            onSubmit: _login,
          ),
        _Step.range => _RangeForm(
            start: _rangeStart,
            end: _rangeEnd,
            earliestBound: _earliestBound,
            latestBound: _latestBound,
            busy: _busy,
            error: _error,
            onPickStart: () => _pickDate(isStart: true),
            onPickEnd: () => _pickDate(isStart: false),
            onSubmit: _loadPreview,
          ),
        _Step.preview => _PreviewList(
            categories: _preview,
            visibility: _visibility,
            onChangeVisibility: (name, v) => setState(() => _visibility[name] = v),
            busy: _busy,
            error: _error,
            importedCount: _importedCount,
            importTotal: _importTotal,
            onConfirm: _confirmImport,
          ),
      },
    );
  }
}

Color _androidColorToColor(int? value) =>
    value == null ? AppColors.palette.first : Color(0xFF000000 | (value & 0xFFFFFF));

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.email,
    required this.password,
    required this.busy,
    required this.error,
    required this.onSubmit,
  });

  final TextEditingController email;
  final TextEditingController password;
  final bool busy;
  final String? error;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      children: [
        const Text(
          '투두메이트 계정으로 로그인하면, 본인 소유 일정만 가져올 수 있어요.\n'
          '구글·애플 로그인 계정은 투두메이트 앱 설정에서 비밀번호를 먼저 연결해야 해요.',
          style: TextStyle(color: AppColors.subtle, fontSize: 13),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: email,
          autofocus: true,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: '투두메이트 이메일'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: password,
          obscureText: true,
          decoration: const InputDecoration(labelText: '비밀번호'),
          onSubmitted: busy ? null : (_) => onSubmit(),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: busy ? null : onSubmit,
            style: FilledButton.styleFrom(backgroundColor: AppColors.ink, padding: const EdgeInsets.symmetric(vertical: 14)),
            child: const Text('다음'),
          ),
        ),
        if (busy) const Padding(
          padding: EdgeInsets.only(top: 20),
          child: LinearProgressIndicator(color: AppColors.ink),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(error!, style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
          ),
      ],
    );
  }
}

class _RangeForm extends StatelessWidget {
  const _RangeForm({
    required this.start,
    required this.end,
    required this.earliestBound,
    required this.latestBound,
    required this.busy,
    required this.error,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onSubmit,
  });

  final DateTime start;
  final DateTime end;
  final DateTime earliestBound;
  final DateTime latestBound;
  final bool busy;
  final String? error;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      children: [
        Text(
          '가져올 수 있는 기간: ${ymd(earliestBound)} ~ ${ymd(latestBound)}',
          style: const TextStyle(color: AppColors.subtle, fontSize: 13),
        ),
        const SizedBox(height: 24),
        _DateRow(label: '시작일', date: start, onTap: busy ? null : onPickStart),
        const SizedBox(height: 12),
        _DateRow(label: '종료일', date: end, onTap: busy ? null : onPickEnd),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: busy ? null : onSubmit,
            style: FilledButton.styleFrom(backgroundColor: AppColors.ink, padding: const EdgeInsets.symmetric(vertical: 14)),
            child: const Text('일정 불러오기'),
          ),
        ),
        if (busy) const Padding(
          padding: EdgeInsets.only(top: 20),
          child: LinearProgressIndicator(color: AppColors.ink),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(error!, style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
          ),
      ],
    );
  }
}

class _DateRow extends StatelessWidget {
  const _DateRow({required this.label, required this.date, required this.onTap});

  final String label;
  final DateTime date;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.chipBg,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            child: Row(
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const Spacer(),
                Text(ymd(date), style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, color: AppColors.subtle),
              ],
            ),
          ),
        ),
      );
}

class _PreviewList extends StatelessWidget {
  const _PreviewList({
    required this.categories,
    required this.visibility,
    required this.onChangeVisibility,
    required this.busy,
    required this.error,
    required this.importedCount,
    required this.importTotal,
    required this.onConfirm,
  });

  final List<TodoMateCategory> categories;
  final Map<String, CategoryVisibility> visibility;
  final void Function(String name, CategoryVisibility visibility) onChangeVisibility;
  final bool busy;
  final String? error;
  final int importedCount;
  final int importTotal;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final total = categories.fold<int>(0, (sum, c) => sum + c.todos.length);

    if (categories.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.inbox_rounded, size: 44, color: AppColors.blob),
            SizedBox(height: 12),
            Text('그 기간에는 가져올 일정이 없어요', style: TextStyle(color: AppColors.subtle, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
          child: Text(
            '카테고리 ${categories.length}개 · 할 일 $total건을 가져와요.\n'
            '투두메이트의 공유 대상(친구·크루)은 가져올 수 없어, 공개설정만 공개/비공개로 옮기고 아래에서 다시 확인해 주세요.',
            style: const TextStyle(color: AppColors.subtle, fontSize: 13),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
            itemCount: categories.length,
            separatorBuilder: (_, __) => const SizedBox(height: 20),
            itemBuilder: (context, index) {
              final category = categories[index];
              final v = visibility[category.name] ?? CategoryVisibility.private;
              final previewColor = _androidColorToColor(category.androidColor);
              return _PreviewCategorySection(
                category: category,
                color: previewColor,
                visibility: v,
                onChangeVisibility: (next) => onChangeVisibility(category.name, next),
              );
            },
          ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (busy && importTotal > 0) ...[
                LinearProgressIndicator(
                  color: AppColors.ink,
                  value: importTotal == 0 ? null : importedCount / importTotal,
                ),
                const SizedBox(height: 8),
                Text('$importedCount / $importTotal 가져오는 중...',
                    style: const TextStyle(color: AppColors.subtle, fontSize: 12), textAlign: TextAlign.center),
                const SizedBox(height: 12),
              ] else if (busy) ...[
                const LinearProgressIndicator(color: AppColors.ink),
                const SizedBox(height: 12),
              ],
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(error!, style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
                ),
              FilledButton(
                onPressed: busy ? null : onConfirm,
                style: FilledButton.styleFrom(backgroundColor: AppColors.ink, padding: const EdgeInsets.symmetric(vertical: 14)),
                child: const Text('TodoBuddy로 가져오기'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PreviewCategorySection extends StatelessWidget {
  const _PreviewCategorySection({
    required this.category,
    required this.color,
    required this.visibility,
    required this.onChangeVisibility,
  });

  final TodoMateCategory category;
  final Color color;
  final CategoryVisibility visibility;
  final ValueChanged<CategoryVisibility> onChangeVisibility;

  @override
  Widget build(BuildContext context) {
    // 미리보기 표시용으로만 쓰는, 아직 서버에 없는 임시 카테고리 값.
    final draftCategory = Category(
      id: -1,
      name: category.name,
      color: color,
      visibility: visibility,
      ownerId: 0,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(child: CategoryPill(category: draftCategory)),
            const Spacer(),
            _VisibilityToggle(value: visibility, onChanged: onChangeVisibility),
          ],
        ),
        const SizedBox(height: 8),
        for (final todo in category.todos)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                TodoCheckbox(color: color, checked: todo.completed),
                const SizedBox(width: 10),
                SizedBox(
                  width: 72,
                  child: Text(ymd(todo.date), style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
                ),
                Expanded(
                  child: Text(
                    todo.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: todo.completed ? AppColors.subtle : AppColors.ink,
                      decoration: todo.completed ? TextDecoration.lineThrough : null,
                      decorationColor: AppColors.subtle,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// 공개/비공개만 고를 수 있는 작은 토글. (투두메이트의 세분화된 공유 대상은 옮길 수 없다.)
class _VisibilityToggle extends StatelessWidget {
  const _VisibilityToggle({required this.value, required this.onChanged});

  final CategoryVisibility value;
  final ValueChanged<CategoryVisibility> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget option(CategoryVisibility v) {
      final selected = value == v;
      return InkWell(
        onTap: () => onChanged(v),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? AppColors.ink : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(v.icon, size: 13, color: selected ? Colors.white : AppColors.subtle),
              const SizedBox(width: 4),
              Text(v.label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected ? Colors.white : AppColors.subtle)),
            ],
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(color: AppColors.chipBg, borderRadius: BorderRadius.circular(18)),
      padding: const EdgeInsets.all(2),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        option(CategoryVisibility.private),
        option(CategoryVisibility.public),
      ]),
    );
  }
}
