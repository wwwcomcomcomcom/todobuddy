import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// 위젯 테스트용 가짜 TodoBuddy 서버.
/// 실제 서버의 응답 모양을 그대로 흉내 내고, 어떤 요청이 왔는지 기록한다.
class FakeServer {
  final List<String> requests = [];

  http.Client get client => MockClient((request) async {
        final path = request.url.path;
        requests.add('${request.method} $path');

        Object? body;
        switch ('${request.method} $path') {
          case 'GET /auth/config':
            body = {'googleEnabled': false, 'googleClientId': '', 'devLoginEnabled': true};
          case 'POST /auth/dev':
            body = {'token': 'test-token', 'user': _me};
          case 'GET /auth/me':
            body = _me;
          case 'GET /crews':
            body = [_crew];
          case 'GET /friends':
            body = {
              'friends': [
                {..._friend, 'friendshipId': 7},
              ],
              'incoming': const [],
              'outgoing': const [],
            };
          case 'GET /board':
            body = _board;
          case 'GET /board/calendar':
            body = {
              'year': 2026,
              'month': 9,
              'days': [
                {
                  'date': '2026-09-15',
                  'segments': [
                    {'categoryId': 1, 'color': '#EE8B8B', 'total': 1, 'done': 1},
                    {'categoryId': 2, 'color': '#F5C543', 'total': 2, 'done': 1},
                  ],
                },
              ],
            };
          default:
            if (request.method == 'PATCH' && path.startsWith('/todos/')) {
              body = {
                'id': 11,
                'categoryId': 2,
                'date': '2026-09-15',
                'title': '디자인 리뷰 준비',
                'done': true,
                'sortOrder': 0,
              };
            } else {
              return http.Response(jsonEncode({'error': 'not_found'}), 404);
            }
        }
        return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      });

  static const _me = {
    'type': 'user',
    'id': 1,
    'name': '하루',
    'bio': '',
    'handle': 'haru',
    'avatarUrl': null,
  };

  static const _friend = {
    'type': 'user',
    'id': 2,
    'name': '민서',
    'bio': '',
    'handle': 'minseo',
    'avatarUrl': null,
  };

  static const _crew = {
    'type': 'crew',
    'id': 1,
    'name': '달리기모임',
    'bio': '같이 달리는 사람들',
    'avatarUrl': null,
    'inviteCode': 'RUNNING1',
    'ownerId': 1,
    'memberCount': 2,
  };

  static const _board = {
    'date': '2026-09-15',
    'scopeKind': 'user',
    'profile': _me,
    'categories': [
      {
        'id': 1,
        'name': '회사에서 할 일',
        'color': '#EE8B8B',
        'visibility': 'private',
        'sortOrder': 0,
        'owner': {'id': 1, 'name': '하루', 'avatarUrl': null},
        'editable': true,
        'shares': [],
        'todos': [
          {'id': 10, 'categoryId': 1, 'date': '2026-09-15', 'title': '주간 보고서 쓰기', 'done': true, 'sortOrder': 0},
        ],
      },
      {
        'id': 2,
        'name': '혼자 하는 일',
        'color': '#F5C543',
        'visibility': 'public',
        'sortOrder': 1,
        'owner': {'id': 1, 'name': '하루', 'avatarUrl': null},
        'editable': true,
        'shares': [],
        'todos': [
          {'id': 11, 'categoryId': 2, 'date': '2026-09-15', 'title': '디자인 리뷰 준비', 'done': false, 'sortOrder': 0},
          {'id': 12, 'categoryId': 2, 'date': '2026-09-15', 'title': '러닝 30분', 'done': true, 'sortOrder': 1},
        ],
      },
    ],
  };
}
