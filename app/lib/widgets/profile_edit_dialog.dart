import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/app_state.dart';
import '../theme.dart';
import 'avatar.dart';

Future<void> showProfileEditDialog(BuildContext context) => showDialog(
      context: context,
      builder: (_) => const _ProfileEditDialog(),
    );

class _ProfileEditDialog extends StatefulWidget {
  const _ProfileEditDialog();

  @override
  State<_ProfileEditDialog> createState() => _ProfileEditDialogState();
}

class _ProfileEditDialogState extends State<_ProfileEditDialog> {
  late final AppState _state;
  late final TextEditingController _name;
  late final TextEditingController _bio;
  String? _avatarUrl;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _state = context.read<AppState>();
    _name = TextEditingController(text: _state.me?.name ?? '');
    _bio = TextEditingController(text: _state.me?.bio ?? '');
    _avatarUrl = _state.me?.avatarUrl;
  }

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    const typeGroup = XTypeGroup(label: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']);
    final file = await openFile(acceptedTypeGroups: const [typeGroup]);
    if (file == null) return;

    setState(() => _busy = true);
    try {
      final url = await _state.api.uploadImage(filename: file.name, bytes: await file.readAsBytes());
      setState(() => _avatarUrl = url);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    await _state.updateProfile(name: _name.text.trim(), bio: _bio.text.trim(), avatarUrl: _avatarUrl);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('프로필 수정', style: TextStyle(fontWeight: FontWeight.w800)),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Stack(
                children: [
                  Avatar(name: _name.text, imageUrl: _state.api.resolveUrl(_avatarUrl), size: 88),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Material(
                      color: AppColors.ink,
                      shape: const CircleBorder(),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: _busy ? null : _pickImage,
                        child: const SizedBox(
                          width: 28,
                          height: 28,
                          child: Icon(Icons.photo_camera_rounded, size: 15, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: '이름'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _bio,
              maxLines: 3,
              decoration: const InputDecoration(labelText: '한 줄 소개', alignLabelWithHint: true),
            ),
            if (_state.me?.handle != null) ...[
              const SizedBox(height: 12),
              Text('친구 추가 아이디: @${_state.me!.handle}',
                  style: const TextStyle(fontSize: 12, color: AppColors.subtle)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.sunday, fontSize: 12)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('취소')),
        FilledButton(
          onPressed: _busy || _name.text.trim().isEmpty ? null : _save,
          style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
          child: const Text('완료'),
        ),
      ],
    );
  }
}
