import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/update_config.dart';

/// GitHub 최신 릴리스에서 지금 플랫폼용 새 버전을 찾았을 때 담기는 정보.
class UpdateInfo {
  UpdateInfo({required this.version, required this.downloadUrl});

  final String version;
  final String downloadUrl;
}

/// GitHub Releases 를 봐서 지금 실행 중인 버전보다 새 버전이 있는지 확인한다.
/// TodoBuddy 서버와는 무관한 별도 통로라 `ApiClient`/`AppState` 를 거치지 않는다.
class UpdateChecker {
  UpdateChecker({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// 새 버전이 있으면 정보를 돌려주고, 없거나 확인에 실패하면 조용히 `null` 을 돌려준다.
  /// (시작 시 자동으로 도는 검사라 네트워크 오류 등으로 앱 사용을 막으면 안 된다.)
  ///
  /// `currentVersion` 은 테스트에서 `kCurrentAppVersion`(빌드 시 주입되는 실제 버전) 대신
  /// 임의의 값을 넣어 비교 로직만 확인할 수 있도록 열어 둔 값이다.
  Future<UpdateInfo?> checkForUpdate({String? currentVersion}) async {
    try {
      final uri = Uri.https('api.github.com', '/repos/$kGithubRepoSlug/releases/latest');
      final response = await _client.get(uri, headers: {'accept': 'application/vnd.github+json'});
      if (response.statusCode != 200) return null;

      final release = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
      final tagName = release['tag_name'] as String?;
      if (tagName == null) return null;
      final latestVersion = tagName.startsWith('v') ? tagName.substring(1) : tagName;
      if (!isNewerVersion(latestVersion, currentVersion ?? kCurrentAppVersion)) return null;

      final suffix = Platform.isMacOS
          ? '-macos.zip'
          : Platform.isWindows
              ? '-windows.zip'
              : null;
      if (suffix == null) return null;

      final assets = (release['assets'] as List? ?? const []).cast<Map<String, dynamic>>();
      for (final asset in assets) {
        final name = asset['name'] as String? ?? '';
        if (name.endsWith(suffix)) {
          final url = asset['browser_download_url'] as String?;
          if (url == null) return null;
          return UpdateInfo(version: latestVersion, downloadUrl: url);
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}

/// `latest` 가 `current` 보다 높은 버전인지 컴포넌트별로 비교한다.
/// 둘 중 하나라도 `X.Y.Z` 형태의 순수 숫자가 아니면(예: 로컬 디버그의 `0.0.0-dev`) 비교할 수
/// 없다고 보고 `false` 를 돌려준다 — 알 수 없으면 업데이트를 권하지 않는 쪽이 안전하다.
bool isNewerVersion(String latest, String current) {
  final latestParts = _parseVersion(latest);
  final currentParts = _parseVersion(current);
  if (latestParts == null || currentParts == null) return false;

  for (var i = 0; i < 3; i++) {
    if (latestParts[i] != currentParts[i]) return latestParts[i] > currentParts[i];
  }
  return false;
}

List<int>? _parseVersion(String version) {
  final parts = version.split('.');
  if (parts.length != 3) return null;
  final numbers = <int>[];
  for (final part in parts) {
    final n = int.tryParse(part);
    if (n == null) return null;
    numbers.add(n);
  }
  return numbers;
}
