import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../models/routine.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'category_form_screen.dart';

class RoutineFormScreen extends StatefulWidget {
  const RoutineFormScreen({super.key, this.routine});
  final Routine? routine;

  @override
  State<RoutineFormScreen> createState() => _RoutineFormScreenState();
}

class _RoutineFormScreenState extends State<RoutineFormScreen> {
  final _title = TextEditingController();
  final _interval = TextEditingController(text: '1');
  List<Category> _categories = [];
  int? _categoryId;
  String _frequency = 'daily';
  String _monthMode = 'dates';
  String _overflow = 'skip';
  Set<int> _weekdays = {1};
  Set<int> _monthDays = {1};
  Set<int> _ordinals = {1};
  late String _startDate;
  String? _endDate;
  bool _loading = true;
  bool _saving = false;
  bool _previewLoading = false;
  String? _loadError;
  String? _error;
  String? _previewError;
  RoutinePreview? _preview;
  Timer? _debounce;
  int _previewRequest = 0;

  String get _timeZone => widget.routine?.timeZone ?? 'Asia/Seoul';
  RoutineRule get _rule => RoutineRule(
    frequency: _frequency,
    interval: int.tryParse(_interval.text) ?? 0,
    weekdays: _weekdays.toList()..sort(),
    monthMode: _monthMode,
    monthDays: _monthDays.toList()..sort(),
    ordinals: _ordinals.toList()..sort(),
    overflow: _overflow,
  );
  Map<String, dynamic> get _input => {
    'title': _title.text.trim(),
    'categoryId': _categoryId,
    'startDate': _startDate,
    'endDate': _endDate,
    'timeZone': _timeZone,
    'rule': _rule.toJson(),
    if (widget.routine != null) 'versionId': widget.routine!.versionId,
  };

  @override
  void initState() {
    super.initState();
    final routine = widget.routine;
    final selected = context.read<AppState>().selectedDate;
    _startDate = routine?.startDate ?? ymd(selected);
    _endDate = routine?.endDate;
    _categoryId = routine?.categoryId;
    _title.text = routine?.title ?? '';
    _interval.text = '${routine?.rule.interval ?? 1}';
    _frequency = routine?.rule.frequency ?? 'daily';
    _monthMode = routine?.rule.monthMode ?? 'dates';
    _overflow = routine?.rule.overflow ?? 'skip';
    _weekdays = {...?routine?.rule.weekdays};
    if (_weekdays.isEmpty) _weekdays = {selected.weekday};
    _monthDays = {...?routine?.rule.monthDays};
    if (_monthDays.isEmpty) _monthDays = {selected.day};
    _ordinals = {...?routine?.rule.ordinals};
    if (_ordinals.isEmpty) _ordinals = {1};
    _loadCategories();
    _refreshPreview();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _title.dispose();
    _interval.dispose();
    super.dispose();
  }

  String _message(Object e) =>
      e is ApiException ? e.message : '서버에 연결하지 못했어요. 다시 시도해 주세요.';

  Future<void> _loadCategories() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final categories = await context.read<AppState>().api.categories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
        if (!categories.any((c) => c.id == _categoryId)) {
          _categoryId = categories.firstOrNull?.id;
        }
      });
    } catch (e) {
      if (mounted) setState(() => _loadError = _message(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _changed(VoidCallback update) {
    _debounce?.cancel();
    _previewRequest++;
    setState(() {
      update();
      _preview = null;
      _previewError = null;
      _previewLoading = true;
      _error = null;
    });
    _debounce = Timer(const Duration(milliseconds: 300), _refreshPreview);
  }

  Future<void> _refreshPreview() async {
    final request = ++_previewRequest;
    setState(() {
      _previewLoading = true;
      _previewError = null;
    });
    try {
      final preview = await context.read<AppState>().api.previewRoutine(_input);
      if (mounted && request == _previewRequest) {
        setState(() => _preview = preview);
      }
    } catch (e) {
      if (mounted && request == _previewRequest) {
        setState(() {
          _preview = null;
          _previewError = _message(e);
        });
      }
    } finally {
      if (mounted && request == _previewRequest) {
        setState(() => _previewLoading = false);
      }
    }
  }

  Future<void> _save() async {
    if (_saving ||
        _preview == null ||
        _previewLoading ||
        _categoryId == null ||
        _title.text.trim().isEmpty) {
      return;
    }
    final state = context.read<AppState>();
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await state.api.saveRoutine(_input, id: widget.routine?.id);
      await state.refreshBoard();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = _message(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDate({required bool end}) async {
    final value = end ? _endDate ?? _startDate : _startDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(value),
      firstDate: DateTime(1900),
      lastDate: DateTime(9999, 12, 31),
      helpText: end ? '반복 종료일' : '반복 시작일',
      cancelText: '취소',
      confirmText: '선택',
    );
    if (!mounted || picked == null) return;
    _changed(() {
      if (end) {
        _endDate = ymd(picked);
      } else {
        _startDate = ymd(picked);
      }
    });
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 10),
    child: Text(
      text,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    ),
  );

  Widget _chips(
    Iterable<int> values,
    Set<int> selected,
    String Function(int) label,
  ) => Wrap(
    spacing: 8,
    runSpacing: 6,
    children: [
      for (final value in values)
        FilterChip(
          label: Text(label(value)),
          selected: selected.contains(value),
          onSelected: (on) => _changed(() {
            on ? selected.add(value) : selected.remove(value);
          }),
        ),
    ],
  );

  Widget _dateTile(String label, String value, VoidCallback onTap) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    subtitle: Text(value),
    trailing: const Icon(Icons.calendar_today_outlined, size: 20),
    onTap: onTap,
  );

  @override
  Widget build(BuildContext context) {
    final canSave =
        !_saving &&
        !_loading &&
        !_previewLoading &&
        _preview != null &&
        _categoryId != null &&
        _title.text.trim().isNotEmpty &&
        _title.text.trim().length <= 500;
    return PopScope(
      canPop: !_saving,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.routine == null ? '반복 일정 추가' : '반복 일정 편집'),
          centerTitle: true,
          actions: [
            TextButton(
              onPressed: canSave ? _save : null,
              child: Text(_saving ? '저장 중' : '저장'),
            ),
            const SizedBox(width: 12),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _loadError != null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_loadError!),
                    TextButton(
                      onPressed: _loadCategories,
                      child: const Text('다시 시도'),
                    ),
                  ],
                ),
              )
            : _categories.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('반복 일정을 담을 카테고리를 먼저 만들어 주세요.'),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const CategoryFormScreen(),
                          ),
                        );
                        if (mounted) await _loadCategories();
                      },
                      child: const Text('카테고리 만들기'),
                    ),
                  ],
                ),
              )
            : AbsorbPointer(
                absorbing: _saving,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 680),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
                      children: [
                        TextField(
                          key: const ValueKey('routine-title'),
                          controller: _title,
                          maxLength: 500,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                          ),
                          decoration: const InputDecoration(
                            labelText: '할 일 이름',
                            hintText: '예: 책 20분 읽기',
                            counterText: '',
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                        _label('카테고리'),
                        DropdownButtonFormField<int>(
                          key: ValueKey(_categoryId),
                          initialValue: _categoryId,
                          isExpanded: true,
                          items: [
                            for (final c in _categories)
                              DropdownMenuItem(
                                value: c.id,
                                child: Text(
                                  c.name,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: widget.routine != null
                              ? null
                              : (id) => setState(() => _categoryId = id),
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                          ),
                        ),
                        _label('반복 주기'),
                        SegmentedButton<String>(
                          segments: const [
                            ButtonSegment(value: 'daily', label: Text('일마다')),
                            ButtonSegment(value: 'weekly', label: Text('주마다')),
                            ButtonSegment(
                              value: 'monthly',
                              label: Text('개월마다'),
                            ),
                          ],
                          selected: {_frequency},
                          onSelectionChanged: (v) =>
                              _changed(() => _frequency = v.first),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          key: const ValueKey('routine-interval'),
                          controller: _interval,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(3),
                          ],
                          decoration: InputDecoration(
                            labelText: '반복 간격',
                            suffixText: switch (_frequency) {
                              'weekly' => '주마다',
                              'monthly' => '개월마다',
                              _ => '일마다',
                            },
                            helperText: '1~999 사이의 간격',
                          ),
                          onChanged: (_) => _changed(() {}),
                        ),
                        if (_frequency == 'monthly') ...[
                          _label('월별 반복 방식'),
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(
                                value: 'dates',
                                label: Text('날짜 선택'),
                              ),
                              ButtonSegment(
                                value: 'weekdays',
                                label: Text('몇째 요일'),
                              ),
                            ],
                            selected: {_monthMode},
                            onSelectionChanged: (v) =>
                                _changed(() => _monthMode = v.first),
                          ),
                          if (_monthMode == 'dates') ...[
                            _label('반복할 날짜'),
                            _chips(
                              [...List.generate(31, (i) => i + 1), -1],
                              _monthDays,
                              (d) => d == -1 ? '마지막 날' : '$d일',
                            ),
                            _label('해당 날짜가 없는 달'),
                            DropdownButtonFormField<String>(
                              initialValue: _overflow,
                              isExpanded: true,
                              items: const [
                                DropdownMenuItem(
                                  value: 'skip',
                                  child: Text('그달은 건너뛰기'),
                                ),
                                DropdownMenuItem(
                                  value: 'lastDay',
                                  child: Text('그달 마지막 날로 대체'),
                                ),
                              ],
                              onChanged: (v) => _changed(() => _overflow = v!),
                            ),
                          ] else ...[
                            _label('몇째 요일인지 선택'),
                            _chips(
                              [1, 2, 3, 4, 5, -1],
                              _ordinals,
                              (n) => ordinalNames[n]!,
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              '다섯째 요일이 없는 달은 건너뛰어요. 같은 날짜는 한 번만 추가돼요.',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.subtle,
                              ),
                            ),
                          ],
                        ],
                        if (_frequency == 'weekly' ||
                            (_frequency == 'monthly' &&
                                _monthMode == 'weekdays')) ...[
                          _label('반복할 요일'),
                          _chips(
                            [1, 2, 3, 4, 5, 6, 7],
                            _weekdays,
                            (d) => weekdayNames[d - 1],
                          ),
                          if (_frequency == 'weekly')
                            const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: Text(
                                '간격은 시작일이 속한 주부터 계산해요. 한 주는 월요일부터 일요일까지예요.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: AppColors.subtle,
                                ),
                              ),
                            ),
                        ],
                        _label('반복 기간'),
                        _dateTile(
                          '시작일',
                          _startDate,
                          () => _pickDate(end: false),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('종료일 없음'),
                          value: _endDate == null,
                          onChanged: (on) =>
                              _changed(() => _endDate = on ? null : _startDate),
                        ),
                        if (_endDate != null)
                          _dateTile(
                            '종료일 (이 날짜까지 포함)',
                            _endDate!,
                            () => _pickDate(end: true),
                          ),
                        Text(
                          '날짜 기준: ${_timeZone == 'Asia/Seoul' ? '한국 시간 (Asia/Seoul)' : _timeZone}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.subtle,
                          ),
                        ),
                        if (widget.routine != null)
                          const Padding(
                            padding: EdgeInsets.only(top: 12),
                            child: Text(
                              '변경은 오늘 이후에 적용돼요. 과거 기록과 이미 완료하거나 개별 수정한 일정은 유지해요. 카테고리는 변경할 수 없어요.',
                              style: TextStyle(fontSize: 13),
                            ),
                          ),
                        _label('예정 날짜 미리보기'),
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.chipBg,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _rule.summary,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '$_startDate부터 · ${_endDate == null ? '종료일 없음' : '$_endDate까지'}',
                              ),
                              const SizedBox(height: 14),
                              if (_previewLoading)
                                const LinearProgressIndicator()
                              else if (_previewError != null) ...[
                                Text(
                                  _previewError!,
                                  style: const TextStyle(
                                    color: AppColors.sunday,
                                  ),
                                ),
                                TextButton(
                                  onPressed: _refreshPreview,
                                  child: const Text('다시 확인'),
                                ),
                              ] else if (_preview != null) ...[
                                if (_preview!.dates.isEmpty)
                                  const Text('이 설정에는 오늘 이후 예정된 일정이 없어요.')
                                else
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      for (final date in _preview!.dates)
                                        Chip(
                                          label: Text(
                                            '$date (${weekdayNames[DateTime.parse(date).weekday - 1]})',
                                          ),
                                        ),
                                    ],
                                  ),
                                if (_startDate.compareTo(_preview!.today) < 0 &&
                                    widget.routine == null)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 10),
                                    child: Text(
                                      '시작일부터 지난 날짜의 일정도 추가돼요.',
                                      style: TextStyle(fontSize: 13),
                                    ),
                                  ),
                              ],
                            ],
                          ),
                        ),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: AppColors.sunday),
                            ),
                          ),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          onPressed: canSave ? _save : null,
                          icon: const Icon(Icons.repeat_rounded),
                          label: Text(_saving ? '저장 중…' : '반복 일정 저장'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}
