import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'avatar.dart';
import 'profile_edit_dialog.dart';

/// 왼쪽 열 맨 위의 프로필. 내 프로필이면 눌러서 수정할 수 있다.
class ProfileCard extends StatelessWidget {
  const ProfileCard({super.key, required this.profile, required this.editable});

  final Profile profile;
  final bool editable;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();
    final hasBio = profile.bio.trim().isNotEmpty;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Avatar(
          name: profile.name,
          imageUrl: state.api.resolveUrl(profile.avatarUrl),
          size: 72,
          isCrew: profile.isCrew,
        ),
        const SizedBox(width: 18),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(profile.name,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              Text(
                hasBio ? profile.bio : (editable ? '프로필에 자기소개를 입력해보세요' : '소개가 아직 없어요'),
                style: TextStyle(
                  fontSize: 14,
                  color: hasBio ? AppColors.ink : AppColors.subtle,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (profile.isCrew && profile.inviteCode != null) ...[
                const SizedBox(height: 8),
                _InviteCodeChip(code: profile.inviteCode!, memberCount: profile.memberCount),
              ],
            ],
          ),
        ),
        if (editable)
          IconButton(
            tooltip: '프로필 수정',
            icon: const Icon(Icons.add_reaction_outlined, color: AppColors.subtle),
            onPressed: () => showProfileEditDialog(context),
          ),
      ],
    );
  }
}

class _InviteCodeChip extends StatelessWidget {
  const _InviteCodeChip({required this.code, this.memberCount});

  final String code;
  final int? memberCount;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ActionChip(
          avatar: const Icon(Icons.key_rounded, size: 15),
          label: Text('초대코드 $code'),
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          backgroundColor: AppColors.chipBg,
          side: BorderSide.none,
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: code));
            if (!context.mounted) return;
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('초대 코드를 복사했어요')));
          },
        ),
        if (memberCount != null)
          Text('멤버 $memberCount명', style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
      ],
    );
  }
}
