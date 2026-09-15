import 'package:flutter/material.dart';

import '../theme.dart';

/// 프로필 사진. 없으면 이름 첫 글자를 보여준다.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.imageUrl, this.size = 40, this.isCrew = false});

  final String name;
  final String? imageUrl;
  final double size;
  final bool isCrew;

  @override
  Widget build(BuildContext context) {
    final initial = name.characters.isEmpty ? '?' : name.characters.first;
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.chipBg,
        shape: isCrew ? BoxShape.rectangle : BoxShape.circle,
        borderRadius: isCrew ? BorderRadius.circular(size * 0.3) : null,
      ),
      child: imageUrl == null
          ? Center(
              child: Text(
                initial,
                style: TextStyle(
                  fontSize: size * 0.42,
                  fontWeight: FontWeight.w700,
                  color: AppColors.subtle,
                ),
              ),
            )
          : Image.network(
              imageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Center(
                child: Text(initial, style: TextStyle(fontSize: size * 0.42, color: AppColors.subtle)),
              ),
            ),
    );
  }
}
