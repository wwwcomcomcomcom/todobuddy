import 'package:flutter/material.dart';

import '../theme.dart';

/// 한 줄만 입력받는 공용 다이얼로그.
///
/// 컨트롤러를 다이얼로그 내부 State 가 들고 있어서, 닫히는 애니메이션 도중에
/// 이미 dispose 된 컨트롤러를 다시 참조하는 문제가 생기지 않는다.
Future<String?> showTextPromptDialog(
  BuildContext context, {
  required String title,
  required String hint,
  required String action,
  String initialText = '',
}) async {
  final value = await showDialog<String>(
    context: context,
    builder: (_) => _TextPromptDialog(
      title: title,
      hint: hint,
      action: action,
      initialText: initialText,
    ),
  );
  return (value == null || value.isEmpty) ? null : value;
}

class _TextPromptDialog extends StatefulWidget {
  const _TextPromptDialog({
    required this.title,
    required this.hint,
    required this.action,
    required this.initialText,
  });

  final String title;
  final String hint;
  final String action;
  final String initialText;

  @override
  State<_TextPromptDialog> createState() => _TextPromptDialogState();
}

class _TextPromptDialogState extends State<_TextPromptDialog> {
  late final _controller = TextEditingController(text: widget.initialText);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() => Navigator.pop(context, _controller.text.trim());

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w800)),
      content: TextField(
        controller: _controller,
        autofocus: true,
        decoration: InputDecoration(hintText: widget.hint),
        onSubmitted: (_) => _submit(),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
        FilledButton(
          onPressed: _submit,
          style: FilledButton.styleFrom(backgroundColor: AppColors.ink),
          child: Text(widget.action),
        ),
      ],
    );
  }
}
