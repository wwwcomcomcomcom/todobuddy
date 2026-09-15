import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/models.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/avatar.dart';

/// 카테고리 등록 / 편집 화면.
class CategoryFormScreen extends StatefulWidget {
  const CategoryFormScreen({super.key, this.category});

  /// null 이면 새로 등록, 있으면 편집.
  final Category? category;

  @override
  State<CategoryFormScreen> createState() => _CategoryFormScreenState();
}

class _CategoryFormScreenState extends State<CategoryFormScreen> {
  late final _name = TextEditingController(text: widget.category?.name ?? '');
  late CategoryVisibility _visibility = widget.category?.visibility ?? CategoryVisibility.private;
  late Color _color = widget.category?.color ?? AppColors.palette.first;
  late Set<ShareTarget> _shares = {...?widget.category?.shares};
  bool _busy = false;

  bool get _isEdit => widget.category != null;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    setState(() => _busy = true);
    await context.read<AppState>().saveCategory(
          id: widget.category?.id,
          name: name,
          color: colorToHex(_color),
          visibility: _visibility,
          shares: _visibility == CategoryVisibility.shared ? _shares.toList() : const [],
        );
    if (mounted) Navigator.pop(context);
  }

  Future<void> _confirmDelete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('카테고리를 삭제할까요?'),
        content: const Text('이 카테고리에 담긴 모든 날짜의 TODO 도 함께 사라져요.'),
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
    if (ok != true || !mounted) return;
    await context.read<AppState>().deleteCategory(widget.category!.id);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final canSave = _name.text.trim().isNotEmpty && !_busy;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(_isEdit ? '카테고리 편집' : '카테고리 등록',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        actions: [
          TextButton(
            onPressed: canSave ? _save : null,
            style: TextButton.styleFrom(foregroundColor: AppColors.ink),
            child: const Text('완료', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            decoration: const InputDecoration(
              hintText: '카테고리 입력',
              hintStyle: TextStyle(color: AppColors.blob, fontSize: 20, fontWeight: FontWeight.w600),
              enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.ink, width: 2)),
              focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: AppColors.ink, width: 2)),
            ),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => canSave ? _save() : null,
          ),
          const SizedBox(height: 28),
          _SettingRow(
            label: '공개설정',
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_visibility.icon, size: 16, color: AppColors.subtle),
                const SizedBox(width: 6),
                Text(_visibility.label, style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            onTap: _pickVisibility,
          ),
          const SizedBox(height: 12),
          _SettingRow(
            label: '색상',
            trailing: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(color: _color, shape: BoxShape.circle),
            ),
            onTap: _pickColor,
          ),
          if (_visibility == CategoryVisibility.shared) ...[
            const SizedBox(height: 24),
            const Text('공유할 대상', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 8),
            _ShareTargetPicker(
              selected: _shares,
              onChanged: (next) => setState(() => _shares = next),
            ),
          ],
          if (_visibility == CategoryVisibility.public)
            const Padding(
              padding: EdgeInsets.only(top: 16),
              child: Text(
                '공개로 두면 모든 친구와 내가 속한 크루에 자동으로 보여요.',
                style: TextStyle(fontSize: 13, color: AppColors.subtle),
              ),
            ),
          if (_isEdit) ...[
            const SizedBox(height: 40),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _busy ? null : _confirmDelete,
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('카테고리 삭제'),
                style: TextButton.styleFrom(foregroundColor: AppColors.sunday),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _pickVisibility() async {
    final picked = await showDialog<CategoryVisibility>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('공개설정', style: TextStyle(fontWeight: FontWeight.w800)),
        children: [
          for (final v in CategoryVisibility.values)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, v),
              child: Row(
                children: [
                  Icon(v.icon, size: 18, color: AppColors.subtle),
                  const SizedBox(width: 12),
                  Text(v.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  if (v == _visibility) const Icon(Icons.check_rounded, size: 18),
                ],
              ),
            ),
        ],
      ),
    );
    if (picked != null) setState(() => _visibility = picked);
  }

  Future<void> _pickColor() async {
    final picked = await showDialog<Color>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('색상', style: TextStyle(fontWeight: FontWeight.w800)),
        content: SizedBox(
          width: 280,
          child: Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final c in AppColors.palette)
                InkWell(
                  onTap: () => Navigator.pop(context, c),
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: c,
                      shape: BoxShape.circle,
                      border: c.toARGB32() == _color.toARGB32()
                          ? Border.all(color: AppColors.ink, width: 3)
                          : null,
                    ),
                    child: c.toARGB32() == _color.toARGB32()
                        ? const Icon(Icons.check_rounded, color: Colors.white, size: 20)
                        : null,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    if (picked != null) setState(() => _color = picked);
  }
}

class _SettingRow extends StatelessWidget {
  const _SettingRow({required this.label, required this.trailing, required this.onTap});

  final String label;
  final Widget trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.chipBg,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
            child: Row(
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const Spacer(),
                trailing,
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, color: AppColors.subtle),
              ],
            ),
          ),
        ),
      );
}

/// 내 크루와 친구를 체크박스로 골라 공유 대상을 정한다.
class _ShareTargetPicker extends StatelessWidget {
  const _ShareTargetPicker({required this.selected, required this.onChanged});

  final Set<ShareTarget> selected;
  final ValueChanged<Set<ShareTarget>> onChanged;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final crews = state.crews;
    final friends = state.friendBook.friends;

    if (crews.isEmpty && friends.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Text('아직 크루나 친구가 없어요. 먼저 친구를 추가해보세요.',
            style: TextStyle(color: AppColors.subtle, fontSize: 13)),
      );
    }

    Set<ShareTarget> withToggled(ShareTarget target, bool on) {
      final next = {...selected};
      on ? next.add(target) : next.remove(target);
      return next;
    }

    Widget tile(Profile profile, ShareTarget target, bool isCrew) {
      final checked = selected.contains(target);
      return CheckboxListTile(
        value: checked,
        dense: true,
        controlAffinity: ListTileControlAffinity.leading,
        activeColor: AppColors.ink,
        contentPadding: EdgeInsets.zero,
        onChanged: (v) => onChanged(withToggled(target, v ?? false)),
        title: Row(
          children: [
            Avatar(
              name: profile.name,
              imageUrl: state.api.resolveUrl(profile.avatarUrl),
              size: 26,
              isCrew: isCrew,
            ),
            const SizedBox(width: 10),
            Text(profile.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(width: 8),
            Text(isCrew ? '크루' : '친구', style: const TextStyle(fontSize: 11, color: AppColors.subtle)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final crew in crews) tile(crew, ShareTarget(type: 'crew', id: crew.id), true),
        for (final friend in friends)
          tile(friend.profile, ShareTarget(type: 'friend', id: friend.profile.id), false),
      ],
    );
  }
}
