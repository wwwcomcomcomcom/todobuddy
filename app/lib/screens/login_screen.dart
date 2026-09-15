import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/google_sign_in.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/text_prompt_dialog.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _busy = false;
  String? _error;
  bool _googleEnabled = false;
  bool _devLoginEnabled = false;
  bool _configLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    try {
      final config = await context.read<AppState>().api.authConfig();
      if (!mounted) return;
      setState(() {
        _googleEnabled = (config['googleEnabled'] as bool?) ?? false;
        _devLoginEnabled = (config['devLoginEnabled'] as bool?) ?? false;
        _configLoaded = true;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = '서버에 연결하지 못했어요. server 모듈이 실행 중인지 확인해 주세요.';
          _configLoaded = true;
        });
      }
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on GoogleSignInException catch (e) {
      setState(() => _error = e.message);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '로그인에 실패했어요: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _devLogin() async {
    final name = await showTextPromptDialog(
      context,
      title: '개발용 로그인',
      hint: '사용할 이름',
      action: '시작',
    );
    if (name == null || !mounted) return;
    await _run(() => context.read<AppState>().signInAsDev(name));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('TodoBuddy', style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              const Text('친구·크루와 하루치 할 일을 나눠요',
                  style: TextStyle(color: AppColors.subtle, fontSize: 14)),
              const SizedBox(height: 40),
              if (!_configLoaded)
                const CircularProgressIndicator(color: AppColors.ink)
              else ...[
                if (_googleEnabled)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : () => _run(context.read<AppState>().signInWithGoogle),
                      icon: const Icon(Icons.login_rounded, size: 18),
                      label: const Text('Google 계정으로 로그인'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.ink,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                if (_googleEnabled && _devLoginEnabled) const SizedBox(height: 10),
                if (_devLoginEnabled)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _busy ? null : _devLogin,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.ink,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('이름만으로 시작하기 (개발용)'),
                    ),
                  ),
                if (!_googleEnabled && _devLoginEnabled)
                  const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: Text(
                      'server/.env 에 GOOGLE_CLIENT_ID 를 넣으면\nGoogle 로그인이 켜져요.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppColors.subtle),
                    ),
                  ),
              ],
              if (_busy) const Padding(
                padding: EdgeInsets.only(top: 24),
                child: LinearProgressIndicator(color: AppColors.ink),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: Text(_error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.sunday, fontSize: 13)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
