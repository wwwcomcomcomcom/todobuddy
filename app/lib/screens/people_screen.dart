import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/avatar.dart';
import '../widgets/text_prompt_dialog.dart';

/// 친구·크루를 관리하는 화면.
class PeopleScreen extends StatelessWidget {
  const PeopleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('친구 · 크루', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          bottom: const TabBar(
            indicatorColor: AppColors.ink,
            labelColor: AppColors.ink,
            unselectedLabelColor: AppColors.subtle,
            labelStyle: TextStyle(fontWeight: FontWeight.w700),
            tabs: [Tab(text: '친구'), Tab(text: '크루')],
          ),
        ),
        body: const TabBarView(children: [_FriendsTab(), _CrewsTab()]),
      ),
    );
  }
}

// ---------------------------------------------------------------- 친구

class _FriendsTab extends StatefulWidget {
  const _FriendsTab();

  @override
  State<_FriendsTab> createState() => _FriendsTabState();
}

class _FriendsTabState extends State<_FriendsTab> {
  final _query = TextEditingController();
  List<Profile> _results = const [];
  bool _searching = false;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _query.text.trim();
    if (q.isEmpty) {
      setState(() => _results = const []);
      return;
    }
    setState(() => _searching = true);
    try {
      final found = await context.read<AppState>().api.searchUsers(q);
      if (mounted) setState(() => _results = found);
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _request(Profile profile) async {
    final status = await context.read<AppState>().requestFriend(userId: profile.id);
    if (!mounted) return;
    _toast(context, status == 'accepted' ? '${profile.name}님과 친구가 되었어요!' : '${profile.name}님에게 요청을 보냈어요');
    setState(() => _results = const []);
    _query.clear();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final book = state.friendBook;

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _query,
                decoration: const InputDecoration(
                  hintText: '이름 또는 아이디로 친구 찾기',
                  prefixIcon: Icon(Icons.search_rounded),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (_) => _search(),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: _searching ? null : _search,
              style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
              child: const Text('검색'),
            ),
          ],
        ),
        if (state.me?.handle != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              children: [
                Text('내 아이디: @${state.me!.handle}',
                    style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 14),
                  color: AppColors.subtle,
                  visualDensity: VisualDensity.compact,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: '@${state.me!.handle}'));
                    if (context.mounted) _toast(context, '아이디를 복사했어요');
                  },
                ),
              ],
            ),
          ),
        for (final profile in _results)
          _PersonTile(
            profile: profile,
            subtitle: '@${profile.handle}',
            trailing: TextButton(onPressed: () => _request(profile), child: const Text('친구 요청')),
          ),
        if (book.incoming.isNotEmpty) ...[
          const _SectionTitle('받은 요청'),
          for (final f in book.incoming)
            _PersonTile(
              profile: f.profile,
              subtitle: '@${f.profile.handle}',
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextButton(
                    onPressed: () => state.acceptFriend(f.friendshipId),
                    child: const Text('수락'),
                  ),
                  TextButton(
                    onPressed: () => state.removeFriend(f.friendshipId),
                    style: TextButton.styleFrom(foregroundColor: AppColors.subtle),
                    child: const Text('거절'),
                  ),
                ],
              ),
            ),
        ],
        if (book.outgoing.isNotEmpty) ...[
          const _SectionTitle('보낸 요청'),
          for (final f in book.outgoing)
            _PersonTile(
              profile: f.profile,
              subtitle: '수락 대기 중',
              trailing: TextButton(
                onPressed: () => state.removeFriend(f.friendshipId),
                style: TextButton.styleFrom(foregroundColor: AppColors.subtle),
                child: const Text('취소'),
              ),
            ),
        ],
        const _SectionTitle('내 친구'),
        if (book.friends.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('아직 친구가 없어요', style: TextStyle(color: AppColors.subtle)),
          ),
        for (final f in book.friends)
          _PersonTile(
            profile: f.profile,
            subtitle: '@${f.profile.handle}',
            trailing: TextButton(
              onPressed: () => _confirmRemove(context, state, f),
              style: TextButton.styleFrom(foregroundColor: AppColors.sunday),
              child: const Text('친구 삭제'),
            ),
          ),
      ],
    );
  }

  Future<void> _confirmRemove(BuildContext context, AppState state, Friend friend) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${friend.profile.name}님을 친구에서 삭제할까요?'),
        content: const Text('서로의 카테고리 공유도 함께 해제돼요.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.sunday),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (ok == true) await state.removeFriend(friend.friendshipId);
  }
}

// ---------------------------------------------------------------- 크루

class _CrewsTab extends StatelessWidget {
  const _CrewsTab();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
      children: [
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _promptCreate(context, state),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('크루 만들기'),
                style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _promptJoin(context, state),
                icon: const Icon(Icons.key_rounded, size: 18),
                label: const Text('초대코드로 참여'),
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.ink),
              ),
            ),
          ],
        ),
        const _SectionTitle('내 크루'),
        if (state.crews.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('아직 참여한 크루가 없어요', style: TextStyle(color: AppColors.subtle)),
          ),
        for (final crew in state.crews)
          _PersonTile(
            profile: crew,
            isCrew: true,
            subtitle: '멤버 ${crew.memberCount ?? 0}명 · 초대코드 ${crew.inviteCode}',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  tooltip: '초대코드 복사',
                  color: AppColors.subtle,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: crew.inviteCode ?? ''));
                    if (context.mounted) _toast(context, '초대 코드를 복사했어요');
                  },
                ),
                TextButton(
                  onPressed: () => _leave(context, state, crew),
                  style: TextButton.styleFrom(foregroundColor: AppColors.sunday),
                  child: Text(crew.ownerId == state.me?.id ? '크루 삭제' : '나가기'),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Future<void> _promptCreate(BuildContext context, AppState state) async {
    final name = await showTextPromptDialog(context, title: '크루 만들기', hint: '크루 이름', action: '만들기');
    if (name == null || !context.mounted) return;
    try {
      final crew = await state.createCrew(name);
      if (context.mounted) _toast(context, '${crew.name} 크루를 만들었어요. 초대코드 ${crew.inviteCode}');
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    }
  }

  Future<void> _promptJoin(BuildContext context, AppState state) async {
    final code = await showTextPromptDialog(context, title: '초대코드로 참여', hint: '예: A1B2C3D4', action: '참여');
    if (code == null || !context.mounted) return;
    try {
      final crew = await state.joinCrew(code);
      if (context.mounted) _toast(context, '${crew.name} 크루에 참여했어요');
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    }
  }

  Future<void> _leave(BuildContext context, AppState state, Profile crew) async {
    try {
      await state.leaveCrew(crew.id);
      if (context.mounted) _toast(context, '${crew.name} 크루에서 나왔어요');
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    }
  }
}

// ---------------------------------------------------------------- 공용 조각

void _toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 28, 0, 4),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      );
}

class _PersonTile extends StatelessWidget {
  const _PersonTile({
    required this.profile,
    required this.subtitle,
    required this.trailing,
    this.isCrew = false,
  });

  final Profile profile;
  final String subtitle;
  final Widget trailing;
  final bool isCrew;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Avatar(
          name: profile.name,
          imageUrl: context.read<AppState>().api.resolveUrl(profile.avatarUrl),
          size: 40,
          isCrew: isCrew,
        ),
        title: Text(profile.name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
        trailing: trailing,
      );
}
