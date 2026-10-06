import 'dart:convert';

import 'package:http/http.dart' as http;

import 'fake_server.dart';

class RoutineServer {
  RoutineServer() {
    server.interceptor = _handle;
  }
  final server = FakeServer();
  final List<http.Request> writes = [];
  final List<Map<String, dynamic>> routines = [];
  bool failSave = false;
  Future<void>? previewDelay;

  static Map<String, dynamic> sample() => {
    'id': 1,
    'versionId': 1,
    'title': '책 읽기',
    'categoryId': 1,
    'startDate': '2026-10-01',
    'endDate': null,
    'timeZone': 'Asia/Seoul',
    'rule': {
      'frequency': 'monthly',
      'interval': 1,
      'monthMode': 'weekdays',
      'ordinals': [2],
      'weekdays': [1],
    },
  };

  http.Response _json(Object? body, [int status = 200]) => http.Response(
    jsonEncode(body),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );

  Future<http.Response?> _handle(http.Request request) async {
    final path = request.url.path;
    if (path == '/categories' && request.method == 'GET') {
      return _json(server.board['categories']);
    }
    if (path == '/routines/preview') {
      final body = jsonDecode(request.body) as Map<String, dynamic>;
      final rule = body['rule'] as Map<String, dynamic>;
      await previewDelay;
      if ((rule['interval'] as int) < 1 ||
          (rule['weekdays'] is List && (rule['weekdays'] as List).isEmpty)) {
        return _json({
          'error': 'invalid_routine',
          'detail': '요일과 반복 간격을 확인해 주세요.',
        }, 400);
      }
      return _json({
        'dates': ['2026-10-12', '2026-11-09', '2026-12-14'],
        'today': '2026-10-02',
        'timeZone': 'Asia/Seoul',
      });
    }
    if (path == '/routines' && request.method == 'GET') return _json(routines);
    if (path.endsWith('/deletion-preview')) {
      return _json({
        'today': '2026-10-02',
        'pastDone': 3,
        'pastUndone': 4,
        'todayCount': 1,
        'futureCount': 8,
        'timeZone': 'Asia/Seoul',
      });
    }
    if (path.startsWith('/routines')) {
      writes.add(request);
      if (request.method == 'DELETE') {
        routines.clear();
        return http.Response('', 204);
      }
      if (failSave) {
        return _json({'error': 'invalid_routine', 'detail': '저장 실패 테스트'}, 400);
      }
      final result = {
        ...jsonDecode(request.body) as Map<String, dynamic>,
        'id': 1,
        'versionId': 2,
      };
      routines
        ..clear()
        ..add(result);
      return _json(result);
    }
    return null;
  }
}
