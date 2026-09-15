import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:todobuddy_app/services/update_checker.dart';

void main() {
  group('isNewerVersion', () {
    test('더 높은 버전이면 true', () {
      expect(isNewerVersion('1.2.0', '1.1.9'), isTrue);
      expect(isNewerVersion('0.1.3', '0.1.2'), isTrue);
      expect(isNewerVersion('1.0.0', '0.9.9'), isTrue);
    });

    test('같거나 낮은 버전이면 false', () {
      expect(isNewerVersion('0.1.2', '0.1.2'), isFalse);
      expect(isNewerVersion('0.1.1', '0.1.2'), isFalse);
    });

    test('숫자가 아닌(dev) 버전은 비교 불가로 취급해 false', () {
      expect(isNewerVersion('0.1.2', '0.0.0-dev'), isFalse);
    });
  });

  group('UpdateChecker.checkForUpdate', () {
    final platformSuffix = Platform.isWindows ? '-windows.zip' : '-macos.zip';

    UpdateChecker checkerFor(http.Client client) => UpdateChecker(client: client);

    test('현재보다 높은 버전과 맞는 asset 이 있으면 UpdateInfo 를 돌려준다', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'tag_name': 'v99.0.0',
            'assets': [
              {'name': 'TodoBuddy-99.0.0$platformSuffix', 'browser_download_url': 'https://example.com/a.zip'},
            ],
          }),
          200,
        );
      });

      final info = await checkerFor(client).checkForUpdate(currentVersion: '1.0.0');
      expect(info, isNotNull);
      expect(info!.version, '99.0.0');
      expect(info.downloadUrl, 'https://example.com/a.zip');
    });

    test('맞는 플랫폼 asset 이 없으면 null', () async {
      final client = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'tag_name': 'v99.0.0',
            'assets': [
              {'name': 'TodoBuddy-99.0.0-linux.zip', 'browser_download_url': 'https://example.com/a.zip'},
            ],
          }),
          200,
        );
      });

      expect(await checkerFor(client).checkForUpdate(currentVersion: '1.0.0'), isNull);
    });

    test('요청이 실패하면 null', () async {
      final client = MockClient((request) async => http.Response('nope', 500));
      expect(await checkerFor(client).checkForUpdate(), isNull);
    });

    test('네트워크 예외가 나면 null', () async {
      final client = MockClient((request) async => throw const SocketException('offline'));
      expect(await checkerFor(client).checkForUpdate(), isNull);
    });
  });
}
