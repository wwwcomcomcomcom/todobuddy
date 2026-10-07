import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum StartupStatus { disabled, enabled, requiresApproval, unsupported }

/// 설정을 별도로 저장하지 않고 운영체제의 등록 상태를 읽는다.
class StartupService {
  static const _channel = MethodChannel('todobuddy/startup');

  bool get isSupported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.macOS ||
          defaultTargetPlatform == TargetPlatform.windows);

  Future<StartupStatus> getStatus() async {
    if (!isSupported) return StartupStatus.unsupported;
    return _decode(await _channel.invokeMethod<String>('getStatus'));
  }

  Future<StartupStatus> setEnabled(bool enabled) async {
    if (!isSupported) return StartupStatus.unsupported;
    return _decode(await _channel.invokeMethod<String>('setEnabled', enabled));
  }

  Future<void> openSettings() async {
    if (isSupported) await _channel.invokeMethod<void>('openSettings');
  }

  StartupStatus _decode(String? value) => switch (value) {
    'disabled' => StartupStatus.disabled,
    'enabled' => StartupStatus.enabled,
    'requiresApproval' => StartupStatus.requiresApproval,
    _ => throw StateError('알 수 없는 자동 실행 상태: $value'),
  };
}
