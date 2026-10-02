import 'dart:convert';

import 'package:http/http.dart' as http;

/// 투두메이트 쪽 요청이 실패했을 때, 화면에 그대로 보여줄 수 있는 한국어 메시지를 담는다.
class TodoMateException implements Exception {
  TodoMateException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// 투두메이트에서 가져온 할 일 한 건.
class TodoMateTodo {
  const TodoMateTodo({required this.title, required this.date, required this.completed});

  final String title;
  final DateTime date;
  final bool completed;
}

/// 투두메이트의 Goal(카테고리) 하나와 그 안의 할 일들.
class TodoMateCategory {
  const TodoMateCategory({
    required this.name,
    required this.androidColor,
    required this.isPrivate,
    required this.todos,
  });

  final String name;

  /// 투두메이트가 안드로이드 ARGB 정수로 들고 있는 색. 없으면 null.
  final int? androidColor;

  /// 투두메이트는 공개 대상(어떤 친구·크루)까지 세분화돼 있지만, 우리는 공개/비공개
  /// 여부만 가져올 수 있다. true 면 투두메이트에서도 비공개였던 카테고리.
  final bool isPrivate;

  final List<TodoMateTodo> todos;
}

/// 투두메이트 계정에 본인 자격증명으로 직접 로그인해 일정을 읽어오는 클라이언트.
///
/// 투두메이트는 공식 API/OAuth/MCP 가 없어서, 투두메이트가 공개 웹 설정으로 노출하는
/// Firebase 설정값을 읽고, 사용자가 입력한 투두메이트 이메일/비밀번호로 Firebase Auth
/// REST 에 직접 로그인한 뒤, 그 토큰으로 본인 소유 Firestore 문서만 조회한다.
/// (구글/애플 로그인 계정은 Firebase 쪽에 비밀번호 자격증명이 없어 이 방식이 통하지
/// 않는다 — 투두메이트 앱에서 이메일/비밀번호를 먼저 연결해야 한다.)
class TodoMateClient {
  TodoMateClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static final _firebaseConfigUrl = Uri.parse('https://www.todomate.net/__/firebase/init.json');
  static const _signInUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
  static const _projectId = 'mate-914f3';
  static const _firestoreBase =
      'https://firestore.googleapis.com/v1/projects/$_projectId/databases/(default)/documents';

  String? _idToken;
  String? _uid;

  bool get isSignedIn => _idToken != null;

  Future<void> signIn(String email, String password) async {
    final apiKey = await _fetchApiKey();
    final res = await _client.post(
      Uri.parse('$_signInUrl?key=$apiKey'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password, 'returnSecureToken': true}),
    );
    if (res.statusCode != 200) throw TodoMateException(_authErrorMessage(res));

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    _idToken = body['idToken'] as String;
    _uid = body['localId'] as String;
  }

  Future<String> _fetchApiKey() async {
    http.Response res;
    try {
      res = await _client.get(_firebaseConfigUrl);
    } catch (_) {
      throw TodoMateException('투두메이트 서버에 연결하지 못했어요.');
    }
    if (res.statusCode != 200) throw TodoMateException('투두메이트 서버에 연결하지 못했어요.');
    final apiKey = (jsonDecode(res.body) as Map<String, dynamic>)['apiKey'] as String?;
    if (apiKey == null) throw TodoMateException('투두메이트 설정을 읽지 못했어요.');
    return apiKey;
  }

  String _authErrorMessage(http.Response res) {
    try {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final message = ((body['error'] as Map?)?['message'] as String?) ?? '';
      if (message.contains('EMAIL_NOT_FOUND') ||
          message.contains('INVALID_PASSWORD') ||
          message.contains('INVALID_LOGIN_CREDENTIALS')) {
        return '이메일 또는 비밀번호가 올바르지 않아요.\n구글·애플 로그인 계정이라면 투두메이트 앱 설정에서 비밀번호를 먼저 연결해 주세요.';
      }
    } catch (_) {
      // 메시지 파싱에 실패해도 아래 기본 메시지로 넘어간다.
    }
    return '투두메이트 로그인에 실패했어요.';
  }

  /// [start] ~ [end] (양끝 포함) 사이에 날짜가 있는 할 일만 카테고리별로 묶어서 돌려준다.
  Future<List<TodoMateCategory>> fetchSchedules({required DateTime start, required DateTime end}) async {
    final uid = _uid;
    if (uid == null) throw TodoMateException('먼저 로그인해 주세요.');

    final goalDocs = await _runEqualityQuery('Goal', 'userID', uid);
    final goalsById = {for (final g in goalDocs) g['_id'] as String: g};

    final todoDocs = await _runEqualityQuery('TodoItem', 'writerID', uid);

    final startMs = DateTime.utc(start.year, start.month, start.day).millisecondsSinceEpoch;
    final endMs = DateTime.utc(end.year, end.month, end.day).millisecondsSinceEpoch;

    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final todo in todoDocs) {
      final dateMs = todo['date'];
      if (dateMs is! int || dateMs < startMs || dateMs > endMs) continue;
      final goalId = todo['goalID'] as String?;
      (grouped[goalId ?? ''] ??= []).add(todo);
    }

    final result = <TodoMateCategory>[];
    grouped.forEach((goalId, todos) {
      final goal = goalId.isEmpty ? null : goalsById[goalId];
      todos.sort((a, b) => (a['date'] as int).compareTo(b['date'] as int));
      result.add(TodoMateCategory(
        name: (goal?['title'] as String?) ?? '(미분류)',
        androidColor: goal?['color'] as int?,
        isPrivate: ((goal?['visibility'] as String?) ?? 'private') == 'private',
        todos: [
          for (final t in todos)
            TodoMateTodo(
              title: ((t['content'] as String?) ?? '').trim(),
              date: DateTime.fromMillisecondsSinceEpoch(t['date'] as int, isUtc: true),
              completed: (t['completed'] as bool?) ?? false,
            ),
        ],
      ));
    });
    return result;
  }

  Future<List<Map<String, dynamic>>> _runEqualityQuery(String collectionId, String field, String value) async {
    final res = await _client.post(
      Uri.parse('$_firestoreBase:runQuery'),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer $_idToken',
      },
      body: jsonEncode({
        'structuredQuery': {
          'from': [{'collectionId': collectionId}],
          'where': {
            'fieldFilter': {
              'field': {'fieldPath': field},
              'op': 'EQUAL',
              'value': {'stringValue': value},
            },
          },
        },
      }),
    );
    if (res.statusCode != 200) throw TodoMateException('투두메이트에서 일정을 가져오지 못했어요.');

    final docs = <Map<String, dynamic>>[];
    for (final item in jsonDecode(res.body) as List) {
      final doc = (item as Map<String, dynamic>)['document'] as Map<String, dynamic>?;
      if (doc == null) continue;
      final fields = _decodeFields((doc['fields'] as Map<String, dynamic>?) ?? const {});
      fields['_id'] = (doc['name'] as String).split('/').last;
      docs.add(fields);
    }
    return docs;
  }

  dynamic _decodeValue(Map<String, dynamic> value) {
    if (value.containsKey('nullValue')) return null;
    if (value.containsKey('booleanValue')) return value['booleanValue'];
    if (value.containsKey('integerValue')) return int.parse(value['integerValue'] as String);
    if (value.containsKey('doubleValue')) return value['doubleValue'];
    if (value.containsKey('stringValue')) return value['stringValue'];
    if (value.containsKey('timestampValue')) return value['timestampValue'];
    if (value.containsKey('mapValue')) {
      final map = (value['mapValue'] as Map<String, dynamic>)['fields'] as Map<String, dynamic>?;
      return _decodeFields(map ?? const {});
    }
    if (value.containsKey('arrayValue')) {
      final values = (value['arrayValue'] as Map<String, dynamic>)['values'] as List? ?? const [];
      return [for (final v in values) _decodeValue(v as Map<String, dynamic>)];
    }
    return null;
  }

  Map<String, dynamic> _decodeFields(Map<String, dynamic> fields) =>
      {for (final e in fields.entries) e.key: _decodeValue(e.value as Map<String, dynamic>)};
}
