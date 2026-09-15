import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'avatar.dart';

/// 화면 맨 위의 "나 · 크루 · 친구" 칩 줄.
class ScopeBar extends StatelessWidget {
  const ScopeBar({super.key, required this.onManagePeople});

  final VoidCallback onManagePeople;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final pendingCount = state.friendBook.incoming.length;

    return SizedBox(
      height: 56,
      child: Row(
        children: [
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: state.scopeTargets.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final target = state.scopeTargets[index];
                final isMe = index == 0;
                final scope = isMe ? 'me' : target.scope;
                return _ScopeChip(
                  profile: target,
                  selected: state.scope == scope,
                  onTap: () => state.selectScope(scope),
                );
              },
            ),
          ),
          const SizedBox(width: 8),
          _RoundIconButton(
            icon: Icons.people_alt_rounded,
            badge: pendingCount,
            tooltip: '친구·크루 관리',
            onPressed: onManagePeople,
          ),
        ],
      ),
    );
  }
}

class _ScopeChip extends StatelessWidget {
  const _ScopeChip({required this.profile, required this.selected, required this.onTap});

  final Profile profile;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final api = context.read<AppState>().api;
    return Material(
      color: selected ? AppColors.ink : AppColors.chipBg,
      shape: const StadiumBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(5, 5, 16, 5),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Avatar(
                name: profile.name,
                imageUrl: api.resolveUrl(profile.avatarUrl),
                size: 32,
                isCrew: profile.isCrew,
              ),
              const SizedBox(width: 10),
              Text(
                profile.name,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onPressed, this.tooltip, this.badge = 0});

  final IconData icon;
  final VoidCallback onPressed;
  final String? tooltip;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Material(
            color: AppColors.chipBg,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              child: SizedBox(width: 42, height: 42, child: Icon(icon, size: 20, color: AppColors.ink)),
            ),
          ),
          if (badge > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: const BoxDecoration(color: AppColors.sunday, shape: BoxShape.circle),
                child: Text('$badge',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ),
        ],
      ),
    );
  }
}
