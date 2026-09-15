import 'package:flutter/material.dart';

import '../services/update_checker.dart';
import '../services/update_installer.dart';
import '../theme.dart';

/// 새 버전 안내 + "지금 업데이트" 한 번으로 설치까지 끝내는 다이얼로그.
Future<void> showUpdateAvailableDialog(BuildContext context, UpdateInfo info) {
  return showDialog<void>(
    context: context,
    builder: (_) => _UpdateDialog(info: info),
  );
}

class _UpdateDialog extends StatefulWidget {
  const _UpdateDialog({required this.info});

  final UpdateInfo info;

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  bool _installing = false;
  double _progress = 0;
  String? _error;

  Future<void> _install() async {
    setState(() {
      _installing = true;
      _error = null;
    });
    try {
      await UpdateInstaller().downloadAndInstall(
        widget.info,
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress);
        },
      );
      // 성공하면 앱 프로세스가 곧 exit(0) 으로 종료되고 새 버전이 재실행되므로 여기까지
      // 도달하지 않는다.
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _installing = false;
        _error = '업데이트를 설치하지 못했어요. 다시 시도해 주세요.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_installing,
      child: AlertDialog(
        title: const Text('새 버전이 있어요', style: TextStyle(fontWeight: FontWeight.w800)),
        content: SizedBox(
          width: 320,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('버전 ${widget.info.version}(으)로 업데이트할 수 있어요.'),
              if (_installing) ...[
                const SizedBox(height: 16),
                LinearProgressIndicator(value: _progress > 0 ? _progress : null),
                const SizedBox(height: 8),
                const Text(
                  '내려받는 중이에요. 잠시 후 앱이 새로 시작돼요.',
                  style: TextStyle(fontSize: 12, color: AppColors.subtle),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.sunday, fontSize: 12)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: _installing ? null : () => Navigator.pop(context),
            child: const Text('나중에'),
          ),
          FilledButton(
            onPressed: _installing ? null : _install,
            style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
            child: const Text('지금 업데이트'),
          ),
        ],
      ),
    );
  }
}
