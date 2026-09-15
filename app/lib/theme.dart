import 'dart:math' as math;
import 'package:flutter/material.dart';

/// 앱 전반에서 쓰는 색. 스크린샷의 담백한 흑백 + 파스텔 포인트 구성을 따른다.
class AppColors {
  static const ink = Color(0xFF111111);
  static const subtle = Color(0xFF9AA0A6);
  static const chipBg = Color(0xFFF1F2F4);
  static const blob = Color(0xFFDDE0E4);
  static const divider = Color(0xFFE6E8EB);
  static const saturday = Color(0xFF3B82F6);
  static const sunday = Color(0xFFEF4444);

  /// 카테고리 색상 팔레트 (카테고리 등록 화면의 선택지).
  static const palette = <Color>[
    Color(0xFF111111),
    Color(0xFFEE8B8B),
    Color(0xFFF5C543),
    Color(0xFF7BC47F),
    Color(0xFF5FB7C9),
    Color(0xFF7AA2F7),
    Color(0xFFB08BEE),
    Color(0xFFEE8BC3),
  ];
}

String colorToHex(Color c) =>
    '#${c.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';

Color hexToColor(String? hex, {Color fallback = AppColors.ink}) {
  if (hex == null) return fallback;
  final cleaned = hex.replaceAll('#', '').trim();
  if (cleaned.length != 6 && cleaned.length != 8) return fallback;
  final value = int.tryParse(cleaned.length == 6 ? 'FF$cleaned' : cleaned, radix: 16);
  return value == null ? fallback : Color(value);
}

/// iOS 앱 아이콘처럼 모서리가 이어지는 스퀘어클(squircle). 캘린더 블롭과 체크박스에 쓴다.
class SquircleBorder extends OutlinedBorder {
  const SquircleBorder({this.radiusFactor = 0.42, super.side});

  /// 짧은 변 대비 모서리 반경 비율. 0.5 에 가까울수록 원에 가까워진다.
  final double radiusFactor;

  @override
  ShapeBorder scale(double t) => SquircleBorder(radiusFactor: radiusFactor, side: side.scale(t));

  @override
  SquircleBorder copyWith({BorderSide? side, double? radiusFactor}) =>
      SquircleBorder(radiusFactor: radiusFactor ?? this.radiusFactor, side: side ?? this.side);

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) =>
      getOuterPath(rect.deflate(side.strokeInset), textDirection: textDirection);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) {
    final r = math.min(rect.width, rect.height) * radiusFactor;
    // 베지어 제어점을 모서리 안쪽으로 당겨 곡률이 끊기지 않게 한다.
    const pull = 0.28;
    final path = Path()..moveTo(rect.left + r, rect.top);
    void corner(Offset from, Offset corner, Offset to) {
      path
        ..lineTo(from.dx, from.dy)
        ..cubicTo(
          from.dx + (corner.dx - from.dx) * (1 - pull), from.dy + (corner.dy - from.dy) * (1 - pull),
          to.dx + (corner.dx - to.dx) * (1 - pull), to.dy + (corner.dy - to.dy) * (1 - pull),
          to.dx, to.dy,
        );
    }

    corner(Offset(rect.right - r, rect.top), rect.topRight, Offset(rect.right, rect.top + r));
    corner(Offset(rect.right, rect.bottom - r), rect.bottomRight, Offset(rect.right - r, rect.bottom));
    corner(Offset(rect.left + r, rect.bottom), rect.bottomLeft, Offset(rect.left, rect.bottom - r));
    corner(Offset(rect.left, rect.top + r), rect.topLeft, Offset(rect.left + r, rect.top));
    return path..close();
  }

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none) return;
    canvas.drawPath(getOuterPath(rect, textDirection: textDirection), side.toPaint());
  }
}

ThemeData buildAppTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: AppColors.ink, primary: AppColors.ink),
    scaffoldBackgroundColor: Colors.white,
    // 한글이 잘 나오는 폰트를 OS 별로 하나씩 갖춰 둔다.
    fontFamilyFallback: const ['Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans CJK KR', 'NanumGothic'],
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: AppColors.ink, displayColor: AppColors.ink),
    dividerColor: AppColors.divider,
    splashFactory: InkSparkle.splashFactory,
  );
}
