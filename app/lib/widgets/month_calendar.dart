import 'package:flutter/material.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';

const _weekdayLabels = ['월', '화', '수', '목', '금', '토', '일'];

/// 왼쪽 열의 월간 캘린더.
///
/// 각 날짜 칸은 그 날 TODO 가 있는 카테고리 색으로 칠해진다.
/// 전부 완료했으면 체크, 아니면 남은 개수를 보여준다.
class MonthCalendar extends StatelessWidget {
  const MonthCalendar({
    super.key,
    required this.month,
    required this.selectedDate,
    required this.segmentsByDate,
    required this.onSelectDate,
    required this.onChangeMonth,
  });

  final DateTime month;
  final DateTime selectedDate;
  final Map<String, List<DaySegment>> segmentsByDate;
  final ValueChanged<DateTime> onSelectDate;
  final ValueChanged<DateTime> onChangeMonth;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Header(month: month, onChangeMonth: onChangeMonth),
        const SizedBox(height: 20),
        Row(
          children: [
            for (var i = 0; i < 7; i++)
              Expanded(
                child: Center(
                  child: Text(
                    _weekdayLabels[i],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: switch (i) { 5 => AppColors.saturday, 6 => AppColors.sunday, _ => AppColors.ink },
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        ..._buildWeeks(),
      ],
    );
  }

  List<Widget> _buildWeeks() {
    final first = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // DateTime.weekday: 월=1 … 일=7. 월요일 시작 그리드로 맞춘다.
    final leading = first.weekday - 1;
    final cells = <DateTime?>[
      ...List.filled(leading, null),
      ...List.generate(daysInMonth, (i) => DateTime(month.year, month.month, i + 1)),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }

    return [
      for (var week = 0; week < cells.length ~/ 7; week++)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: cells[week * 7 + i] == null
                      ? const SizedBox(height: 74)
                      : _DayCell(
                          date: cells[week * 7 + i]!,
                          weekday: i,
                          segments: segmentsByDate[ymd(cells[week * 7 + i]!)] ?? const [],
                          selected: _isSameDay(cells[week * 7 + i]!, selectedDate),
                          isToday: _isSameDay(cells[week * 7 + i]!, DateTime.now()),
                          onTap: () => onSelectDate(cells[week * 7 + i]!),
                        ),
                ),
            ],
          ),
        ),
    ];
  }

  static bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}

class _Header extends StatelessWidget {
  const _Header({required this.month, required this.onChangeMonth});

  final DateTime month;
  final ValueChanged<DateTime> onChangeMonth;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _pickMonth(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${month.year}년 ${month.month}월',
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                const SizedBox(width: 6),
                const Icon(Icons.keyboard_arrow_down_rounded, size: 26),
              ],
            ),
          ),
        ),
        const Spacer(),
        IconButton(
          icon: const Icon(Icons.chevron_left_rounded),
          tooltip: '이전 달',
          onPressed: () => onChangeMonth(DateTime(month.year, month.month - 1)),
        ),
        IconButton(
          icon: const Icon(Icons.chevron_right_rounded),
          tooltip: '다음 달',
          onPressed: () => onChangeMonth(DateTime(month.year, month.month + 1)),
        ),
      ],
    );
  }

  Future<void> _pickMonth(BuildContext context) async {
    var year = month.year;
    final picked = await showDialog<DateTime>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left_rounded),
                onPressed: () => setState(() => year--),
              ),
              Text('$year년', style: const TextStyle(fontWeight: FontWeight.w800)),
              IconButton(
                icon: const Icon(Icons.chevron_right_rounded),
                onPressed: () => setState(() => year++),
              ),
            ],
          ),
          content: SizedBox(
            width: 300,
            child: GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
                for (var m = 1; m <= 12; m++)
                  Material(
                    color: (year == month.year && m == month.month) ? AppColors.ink : AppColors.chipBg,
                    borderRadius: BorderRadius.circular(10),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => Navigator.pop(context, DateTime(year, m)),
                      child: Center(
                        child: Text('$m월',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: (year == month.year && m == month.month) ? Colors.white : AppColors.ink,
                            )),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    if (picked != null) onChangeMonth(picked);
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.weekday,
    required this.segments,
    required this.selected,
    required this.isToday,
    required this.onTap,
  });

  final DateTime date;
  final int weekday;
  final List<DaySegment> segments;
  final bool selected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final numberColor = selected
        ? Colors.white
        : switch (weekday) { 5 => AppColors.saturday, 6 => AppColors.sunday, _ => AppColors.ink };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        height: 74,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _DayBlob(segments: segments),
            const SizedBox(height: 6),
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? AppColors.ink : (isToday ? AppColors.chipBg : Colors.transparent),
              ),
              child: Text(
                '${date.day}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected || isToday ? FontWeight.w800 : FontWeight.w500,
                  color: numberColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 날짜 칸의 색 블록. 카테고리가 여러 개면 색을 가로 띠로 나눠 쌓는다.
class _DayBlob extends StatelessWidget {
  const _DayBlob({required this.segments});

  final List<DaySegment> segments;

  @override
  Widget build(BuildContext context) {
    const size = 30.0;
    if (segments.isEmpty) {
      return const _Squircle(size: size, child: ColoredBox(color: AppColors.blob));
    }

    final remaining = segments.fold<int>(0, (sum, s) => sum + s.remaining);
    return _Squircle(
      size: size,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Column(
            // stretch 가 없으면 색 띠가 교차축 loose 제약을 받아 너비 0 으로 접힌다.
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final s in segments) Expanded(child: ColoredBox(color: s.color)),
            ],
          ),
          Center(
            child: remaining == 0
                ? const Icon(Icons.check_rounded, size: 19, color: Colors.white)
                : Text(
                    '$remaining',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                  ),
          ),
        ],
      ),
    );
  }
}

class _Squircle extends StatelessWidget {
  const _Squircle({required this.size, required this.child});

  final double size;
  final Widget child;

  @override
  Widget build(BuildContext context) => ClipPath(
        clipper: const _SquircleClipper(),
        child: SizedBox(width: size, height: size, child: child),
      );
}

class _SquircleClipper extends CustomClipper<Path> {
  const _SquircleClipper();

  @override
  Path getClip(Size size) => const SquircleBorder().getOuterPath(Offset.zero & size);

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
