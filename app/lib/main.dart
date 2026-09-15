import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'state/app_state.dart';
import 'theme.dart';
import 'widgets/update_gate.dart';

void main() {
  runApp(const TodoBuddyApp());
}

class TodoBuddyApp extends StatelessWidget {
  const TodoBuddyApp({super.key, this.state});

  /// 테스트에서 미리 만든 상태를 끼워 넣기 위한 통로. 실제 실행에서는 null.
  final AppState? state;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => (state ?? AppState())..restoreSession(),
      child: MaterialApp(
        title: 'Todo Buddy',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final status = context.select<AppState, AuthStatus>((s) => s.status);
    return switch (status) {
      AuthStatus.unknown => const Scaffold(
          body: Center(child: CircularProgressIndicator(color: AppColors.ink)),
        ),
      AuthStatus.signedOut => const LoginScreen(),
      AuthStatus.signedIn => const UpdateGate(child: HomeScreen()),
    };
  }
}
