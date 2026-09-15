import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:todobuddy_app/theme.dart';

void main() {
  test('hex 문자열과 Color 를 서로 변환한다', () {
    expect(colorToHex(const Color(0xFFEE8B8B)), '#EE8B8B');
    expect(hexToColor('#EE8B8B'), const Color(0xFFEE8B8B));
    expect(hexToColor('이상한값'), AppColors.ink);
    expect(hexToColor(null, fallback: AppColors.subtle), AppColors.subtle);
  });

  test('스퀘어클 경로는 주어진 사각형 안에 들어온다', () {
    const rect = Rect.fromLTWH(0, 0, 30, 30);
    final bounds = const SquircleBorder().getOuterPath(rect).getBounds();
    expect(rect.contains(bounds.topLeft), isTrue);
    expect(bounds.width, closeTo(30, 0.01));
  });
}
