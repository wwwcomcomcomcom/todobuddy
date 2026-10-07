import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/startup_service.dart';
import '../state/app_state.dart';
import '../theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  void _refresh() {
    if (mounted) context.read<AppState>().refreshStartupStatus();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final status = state.startupStatus;
    final supported = status != StartupStatus.unsupported;
    final needsApproval = status == StartupStatus.requiresApproval;

    return Scaffold(
      appBar: AppBar(title: const Text('앱 설정')),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                secondary: const Icon(Icons.power_settings_new_rounded),
                title: const Text('컴퓨터 시작 시 자동 실행'),
                subtitle: Text(
                  supported
                      ? '컴퓨터에 로그인하면 Todo Buddy 창이 자동으로 열려요.'
                      : 'Windows와 macOS에서 사용할 수 있어요.',
                ),
                value: status == StartupStatus.enabled || needsApproval,
                onChanged: state.startupBusy || status == null || !supported
                    ? null
                    : state.setStartupEnabled,
              ),
              if (state.startupBusy) ...[
                const SizedBox(height: 12),
                const LinearProgressIndicator(color: AppColors.ink),
              ],
              if (needsApproval) ...[
                const SizedBox(height: 16),
                const Text(
                  '자동 실행이 아직 허용되지 않았어요. 시스템 설정에서 Todo Buddy를 허용해 주세요.',
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: state.startupBusy
                        ? null
                        : state.openStartupSettings,
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: const Text('시스템 설정 열기'),
                  ),
                ),
              ],
              if (state.startupError != null) ...[
                const SizedBox(height: 16),
                Text(
                  state.startupError!,
                  style: const TextStyle(color: AppColors.sunday),
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: state.startupBusy ? null : _refresh,
                    child: const Text('다시 시도'),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              const Text(
                '이 설정은 이 컴퓨터의 사용자 계정에 적용돼요.\n'
                '앱을 사용할 폴더에 옮긴 뒤 켜 주세요. 앱 위치를 바꾸면 껐다가 다시 켜 주세요.',
                style: TextStyle(color: AppColors.subtle, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
