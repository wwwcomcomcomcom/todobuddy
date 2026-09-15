import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:url_launcher/url_launcher.dart';

/// 데스크탑용 구글 로그인: PKCE + loopback 리다이렉트.
///
/// 앱이 127.0.0.1 의 임의 포트에 잠깐 서버를 열고 시스템 브라우저로 동의 화면을 띄운다.
/// 구글이 그 주소로 authorization code 를 돌려주면, 코드 자체는 우리 서버가
/// client_secret 과 함께 토큰으로 교환한다. (앱에는 secret 을 두지 않는다.)
///
/// macOS / Windows / Linux 가 같은 코드를 쓴다. 브라우저에서는 스스로 포트를 열 수 없어
/// 이 방식을 그대로 쓸 수 없다 — 웹을 지원하게 되면 리다이렉트 방식이 따로 필요하다.
class GoogleLoopbackSignIn {
  GoogleLoopbackSignIn({required this.clientId});

  final String clientId;

  static const _authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  static const _scopes = 'openid email profile';

  static String _randomString(int length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    final rng = Random.secure();
    return List.generate(length, (_) => chars[rng.nextInt(chars.length)]).join();
  }

  /// 동의 화면을 띄우고 authorization code 와 code_verifier 를 돌려준다.
  /// 사용자가 창을 닫는 등으로 끝나지 않으면 [timeout] 후 예외를 던진다.
  Future<({String code, String codeVerifier, String redirectUri})> authorize({
    Duration timeout = const Duration(minutes: 3),
  }) async {
    final verifier = _randomString(64);
    final challenge = base64Url.encode(sha256.convert(ascii.encode(verifier)).bytes).replaceAll('=', '');
    final state = _randomString(16);

    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final redirectUri = 'http://127.0.0.1:${server.port}';

    final authUrl = Uri.parse(_authEndpoint).replace(queryParameters: {
      'client_id': clientId,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'scope': _scopes,
      'state': state,
      'code_challenge': challenge,
      'code_challenge_method': 'S256',
      'prompt': 'select_account',
    });

    try {
      if (!await launchUrl(authUrl, mode: LaunchMode.externalApplication)) {
        throw const GoogleSignInException('브라우저를 열지 못했어요.');
      }

      final request = await server.first.timeout(timeout);
      final params = request.uri.queryParameters;
      await _respondAndClose(request, params.containsKey('code'));

      if (params['state'] != state) throw const GoogleSignInException('로그인 응답이 올바르지 않아요.');
      if (params['error'] != null) throw GoogleSignInException('구글 로그인이 취소되었어요. (${params['error']})');
      final code = params['code'];
      if (code == null) throw const GoogleSignInException('인증 코드를 받지 못했어요.');

      return (code: code, codeVerifier: verifier, redirectUri: redirectUri);
    } finally {
      await server.close(force: true);
    }
  }

  Future<void> _respondAndClose(HttpRequest request, bool success) async {
    final message = success ? '로그인이 완료되었어요. 앱으로 돌아가 주세요.' : '로그인이 취소되었어요.';
    request.response
      ..statusCode = 200
      ..headers.contentType = ContentType.html
      ..write('<!doctype html><meta charset="utf-8"><title>TodoBuddy</title>'
          '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">'
          '<p style="font-size:18px">$message</p></body>');
    await request.response.close();
  }
}

class GoogleSignInException implements Exception {
  const GoogleSignInException(this.message);
  final String message;

  @override
  String toString() => message;
}
