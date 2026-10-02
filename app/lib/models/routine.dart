const weekdayNames = ['월', '화', '수', '목', '금', '토', '일'];
const ordinalNames = {1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째', -1: '마지막'};

class RoutineRule {
  const RoutineRule({
    this.frequency = 'daily',
    this.interval = 1,
    this.weekdays = const [1],
    this.monthMode = 'dates',
    this.monthDays = const [1],
    this.ordinals = const [1],
    this.overflow = 'skip',
  });

  final String frequency;
  final int interval;
  final List<int> weekdays;
  final String monthMode;
  final List<int> monthDays;
  final List<int> ordinals;
  final String overflow;

  factory RoutineRule.fromJson(Map<String, dynamic> j) => RoutineRule(
    frequency: j['frequency'] as String,
    interval: j['interval'] as int,
    weekdays: (j['weekdays'] as List?)?.cast<int>() ?? const [1],
    monthMode: j['monthMode'] as String? ?? 'dates',
    monthDays: (j['monthDays'] as List?)?.cast<int>() ?? const [1],
    ordinals: (j['ordinals'] as List?)?.cast<int>() ?? const [1],
    overflow: j['overflow'] as String? ?? 'skip',
  );

  Map<String, dynamic> toJson() => {
    'frequency': frequency,
    'interval': interval,
    if (frequency == 'weekly' ||
        (frequency == 'monthly' && monthMode == 'weekdays'))
      'weekdays': weekdays,
    if (frequency == 'monthly') ...{
      'monthMode': monthMode,
      if (monthMode == 'dates') ...{
        'monthDays': monthDays,
        'overflow': overflow,
      } else
        'ordinals': ordinals,
    },
  };

  String get summary {
    final days = weekdays.map((d) => weekdayNames[d - 1]).join('·');
    if (frequency == 'daily') return interval == 1 ? '매일' : '$interval일마다';
    if (frequency == 'weekly') {
      return '${interval == 1 ? '매주' : '$interval주마다'} $days';
    }
    final prefix = interval == 1 ? '매월' : '$interval개월마다';
    if (monthMode == 'dates') {
      return '$prefix ${monthDays.map((d) => d == -1 ? '마지막 날' : '$d일').join('·')}';
    }
    return '$prefix ${ordinals.map((n) => ordinalNames[n]).join('·')} $days요일';
  }
}

class Routine {
  const Routine({
    required this.id,
    required this.categoryId,
    required this.versionId,
    required this.title,
    required this.rule,
    required this.startDate,
    this.endDate,
    this.timeZone = 'Asia/Seoul',
  });

  final int id;
  final int categoryId;
  final int versionId;
  final String title;
  final RoutineRule rule;
  final String startDate;
  final String? endDate;
  final String timeZone;

  factory Routine.fromJson(Map<String, dynamic> j) => Routine(
    id: j['id'] as int,
    categoryId: j['categoryId'] as int,
    versionId: j['versionId'] as int,
    title: j['title'] as String,
    rule: RoutineRule.fromJson(j['rule'] as Map<String, dynamic>),
    startDate: j['startDate'] as String,
    endDate: j['endDate'] as String?,
    timeZone: j['timeZone'] as String,
  );
}

class RoutinePreview {
  const RoutinePreview({required this.dates, required this.today});
  final List<String> dates;
  final String today;
  factory RoutinePreview.fromJson(Map<String, dynamic> j) => RoutinePreview(
    dates: (j['dates'] as List).cast<String>(),
    today: j['today'] as String,
  );
}

class RoutineDeletionPreview {
  const RoutineDeletionPreview({
    required this.today,
    required this.pastDone,
    required this.pastUndone,
    required this.todayCount,
  });
  final String today;
  final int pastDone;
  final int pastUndone;
  final int todayCount;
  factory RoutineDeletionPreview.fromJson(Map<String, dynamic> j) =>
      RoutineDeletionPreview(
        today: j['today'] as String,
        pastDone: j['pastDone'] as int,
        pastUndone: j['pastUndone'] as int,
        todayCount: j['todayCount'] as int,
      );
}
