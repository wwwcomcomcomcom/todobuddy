import 'package:flutter/material.dart';

import '../services/update_checker.dart';
import 'update_dialog.dart';

/// 감싼 화면이 뜨고 나서 한 번 업데이트를 확인하고, 있으면 다이얼로그로 안내한다.
class UpdateGate extends StatefulWidget {
  const UpdateGate({super.key, required this.child});

  final Widget child;

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  Future<void> _check() async {
    final info = await UpdateChecker().checkForUpdate();
    if (info != null && mounted) {
      await showUpdateAvailableDialog(context, info);
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
