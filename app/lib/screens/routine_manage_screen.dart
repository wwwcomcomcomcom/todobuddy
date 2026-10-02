import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../models/routine.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'routine_form_screen.dart';

class RoutineManageScreen extends StatefulWidget {
  const RoutineManageScreen({super.key});
  @override
  State<RoutineManageScreen> createState() => _RoutineManageScreenState();
}

class _RoutineManageScreenState extends State<RoutineManageScreen> {
  List<Routine> _routines = [];
  List<Category> _categories = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<AppState>().api;
    try {
      final results = await Future.wait([api.routines(), api.categories()]);
      if (mounted) {
        setState(() {
          _routines = results[0] as List<Routine>;
          _categories = results[1] as List<Category>;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : '목록을 불러오지 못했어요. 다시 시도해 주세요.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit([Routine? routine]) async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => RoutineFormScreen(routine: routine)),
    );
    if (mounted) await _load();
  }

  Future<void> _delete(Routine routine) async {
    final removed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _DeleteRoutineDialog(
        routine: routine,
        api: context.read<AppState>().api,
      ),
    );
    if (!mounted || removed != true) return;
    await context.read<AppState>().refreshBoard();
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('반복 일정 관리'),
      centerTitle: true,
      actions: [
        IconButton(
          tooltip: '반복 일정 추가',
          onPressed: () => _edit(),
          icon: const Icon(Icons.add_rounded),
        ),
      ],
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!),
                TextButton(onPressed: _load, child: const Text('다시 시도')),
              ],
            ),
          )
        : _routines.isEmpty
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.event_repeat_rounded,
                  size: 40,
                  color: AppColors.subtle,
                ),
                const SizedBox(height: 16),
                const Text('아직 반복 일정이 없어요.'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => _edit(),
                  child: const Text('반복 일정 추가'),
                ),
              ],
            ),
          )
        : Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: ListView.separated(
                padding: const EdgeInsets.all(24),
                itemCount: _routines.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final routine = _routines[index];
                  final category = _categories
                      .where((c) => c.id == routine.categoryId)
                      .firstOrNull;
                  return Material(
                    color: AppColors.chipBg,
                    borderRadius: BorderRadius.circular(14),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => _edit(routine),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(18, 16, 8, 16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 4, right: 12),
                              child: Icon(
                                Icons.repeat_rounded,
                                color: category?.color,
                                size: 20,
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    routine.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(category?.name ?? '카테고리'),
                                  const SizedBox(height: 6),
                                  Text(routine.rule.summary),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${routine.startDate}부터 · ${routine.endDate == null ? '종료일 없음' : '${routine.endDate}까지'}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.subtle,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: '반복 일정 편집',
                              onPressed: () => _edit(routine),
                              icon: const Icon(Icons.edit_outlined, size: 20),
                            ),
                            IconButton(
                              tooltip: '반복 일정 삭제',
                              onPressed: () => _delete(routine),
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                size: 20,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
  );
}

class _DeleteRoutineDialog extends StatefulWidget {
  const _DeleteRoutineDialog({required this.routine, required this.api});
  final Routine routine;
  final ApiClient api;
  @override
  State<_DeleteRoutineDialog> createState() => _DeleteRoutineDialogState();
}

class _DeleteRoutineDialogState extends State<_DeleteRoutineDialog> {
  RoutineDeletionPreview? _preview;
  bool _keepDone = true;
  bool _keepUndone = true;
  bool _removeToday = false;
  bool _busy = false;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _preview = null;
    });
    try {
      final preview = await widget.api.previewRoutineDeletion(
        widget.routine.id,
      );
      if (mounted) setState(() => _preview = preview);
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is ApiException
              ? e.message
              : '기록을 확인하지 못했어요. 다시 시도해 주세요.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete() async {
    if (_busy || _preview == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.api.deleteRoutine(
        widget.routine.id,
        asOfDate: _preview!.today,
        keepPastDone: _keepDone,
        keepPastUndone: _keepUndone,
        removeToday: _removeToday,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e is ApiException ? e.message : '삭제하지 못했어요. 다시 시도해 주세요.';
          if (e is ApiException && e.code == 'routine_date_changed') {
            _preview = null;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final pastDeleted = preview == null
        ? 0
        : (_keepDone ? 0 : preview.pastDone) +
              (_keepUndone ? 0 : preview.pastUndone);
    return PopScope(
      canPop: !_busy,
      child: AlertDialog(
        title: const Text('반복 일정을 삭제할까요?'),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.routine.title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                const Text('반복을 중단하고 앞으로의 일정은 모두 삭제해요.'),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (preview != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    '${preview.today} 기준 · ${widget.routine.timeZone}\n과거는 어제까지의 기록이에요.',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.subtle,
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text('과거 완료 일정 유지 (${preview.pastDone}개)'),
                    value: _keepDone,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _keepDone = v!),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text('과거 미완료 일정 유지 (${preview.pastUndone}개)'),
                    value: _keepUndone,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _keepUndone = v!),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text('오늘 일정도 삭제 (${preview.todayCount}개)'),
                    value: _removeToday,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _removeToday = v!),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '과거 $pastDeleted개 · 오늘 ${_removeToday ? preview.todayCount : 0}개 삭제\n내일부터의 일정도 모두 삭제돼요.',
                    style: const TextStyle(color: AppColors.sunday),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.sunday),
                  ),
                  if (preview == null && !_loading)
                    TextButton(onPressed: _load, child: const Text('다시 확인')),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: _busy || preview == null ? null : _delete,
            style: FilledButton.styleFrom(backgroundColor: AppColors.sunday),
            child: Text(_busy ? '삭제 중…' : '반복 일정 삭제'),
          ),
        ],
      ),
    );
  }
}
