import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/models.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.code, [this.detail]);

  final int statusCode;
  final String code;
  final String? detail;

  /// 사용자에게 그대로 보여줄 수 있는 한국어 메시지.
  String get message => switch (code) {
        'invalid_invite_code' => '초대 코드를 찾을 수 없어요.',
        'user_not_found' => '그런 사용자를 찾지 못했어요.',
        'cannot_friend_self' => '자기 자신에게는 친구 요청을 보낼 수 없어요.',
        'owner_must_transfer_or_empty_crew' => '크루원이 남아 있는 동안에는 방장이 나갈 수 없어요.',
        'google_oauth_not_configured' => '서버에 구글 로그인 설정이 없어요.',
        'unauthorized' => '로그인이 만료되었어요. 다시 로그인해 주세요.',
        'image_too_large' => '이미지가 너무 커요. 5MB 이하로 올려주세요.',
        'unsupported_image_type' => 'png, jpg, gif, webp 만 올릴 수 있어요.',
        _ => detail ?? '요청을 처리하지 못했어요. ($code)',
      };

  @override
  String toString() => 'ApiException($statusCode, $code)';
}

/// TodoBuddy 서버와 이야기하는 유일한 통로.
class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? const String.fromEnvironment('TODOBUDDY_API', defaultValue: 'http://127.0.0.1:4000'),
        _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  /// 로그인 후 모든 요청에 실어 보낼 액세스 토큰.
  String? token;

  /// 서버가 돌려준 상대 경로(`/uploads/…`)를 화면에서 쓸 절대 URL 로 바꾼다.
  String? resolveUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http')) return path;
    return '$baseUrl$path';
  }

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path, {Object? body, Map<String, String>? query}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    final request = http.Request(method, uri)..headers.addAll(_headers);
    if (body != null) request.body = jsonEncode(body);

    final response = await http.Response.fromStream(await _client.send(request));
    if (response.statusCode == 204 || response.body.isEmpty) {
      if (response.statusCode >= 400) throw ApiException(response.statusCode, 'http_${response.statusCode}');
      return null;
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode >= 400) {
      final map = decoded is Map<String, dynamic> ? decoded : const <String, dynamic>{};
      throw ApiException(response.statusCode, (map['error'] as String?) ?? 'unknown', map['detail'] as String?);
    }
    return decoded;
  }

  Future<dynamic> _get(String path, [Map<String, String>? query]) => _send('GET', path, query: query);

  // ----- 인증 -----

  Future<Map<String, dynamic>> authConfig() async => (await _get('/auth/config')) as Map<String, dynamic>;

  Future<({String token, Profile user})> loginWithGoogle({
    required String code,
    required String codeVerifier,
    required String redirectUri,
  }) async {
    final res = await _send('POST', '/auth/google',
        body: {'code': code, 'codeVerifier': codeVerifier, 'redirectUri': redirectUri}) as Map<String, dynamic>;
    return (token: res['token'] as String, user: Profile.fromJson(res['user'] as Map<String, dynamic>));
  }

  Future<({String token, Profile user})> loginAsDev(String name) async {
    final res = await _send('POST', '/auth/dev', body: {'name': name}) as Map<String, dynamic>;
    return (token: res['token'] as String, user: Profile.fromJson(res['user'] as Map<String, dynamic>));
  }

  Future<Profile> me() async => Profile.fromJson((await _get('/auth/me')) as Map<String, dynamic>);

  Future<Profile> updateMe({String? name, String? bio, String? avatarUrl}) async => Profile.fromJson(
      (await _send('PATCH', '/auth/me', body: {
        if (name != null) 'name': name,
        if (bio != null) 'bio': bio,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      })) as Map<String, dynamic>);

  /// 이미지를 base64 로 올리고 서버가 저장한 경로를 돌려받는다.
  Future<String> uploadImage({required String filename, required List<int> bytes}) async {
    final res = await _send('POST', '/uploads',
        body: {'filename': filename, 'dataBase64': base64Encode(bytes)}) as Map<String, dynamic>;
    return res['url'] as String;
  }

  // ----- 보드 / 캘린더 -----

  Future<Board> board({required String scope, required String date}) async =>
      Board.fromJson((await _get('/board', {'scope': scope, 'date': date})) as Map<String, dynamic>);

  Future<Map<String, List<DaySegment>>> calendar({
    required String scope,
    required int year,
    required int month,
  }) async {
    final res = (await _get('/board/calendar', {
      'scope': scope,
      'year': '$year',
      'month': '$month',
    })) as Map<String, dynamic>;

    return {
      for (final day in (res['days'] as List? ?? const []))
        (day as Map<String, dynamic>)['date'] as String: (day['segments'] as List)
            .map((s) => DaySegment.fromJson(s as Map<String, dynamic>))
            .toList(),
    };
  }

  // ----- 카테고리 -----

  Future<List<Category>> categories() async => ((await _get('/categories')) as List)
      .map((e) => Category.fromJson(e as Map<String, dynamic>))
      .toList();

  Future<Category> createCategory({
    required String name,
    required String color,
    required CategoryVisibility visibility,
    List<ShareTarget> shares = const [],
  }) async =>
      Category.fromJson((await _send('POST', '/categories', body: {
        'name': name,
        'color': color,
        'visibility': visibility.wire,
        'shares': shares.map((s) => s.toJson()).toList(),
      })) as Map<String, dynamic>);

  Future<Category> updateCategory(
    int id, {
    String? name,
    String? color,
    CategoryVisibility? visibility,
    List<ShareTarget>? shares,
  }) async =>
      Category.fromJson((await _send('PATCH', '/categories/$id', body: {
        if (name != null) 'name': name,
        if (color != null) 'color': color,
        if (visibility != null) 'visibility': visibility.wire,
        if (shares != null) 'shares': shares.map((s) => s.toJson()).toList(),
      })) as Map<String, dynamic>);

  Future<void> deleteCategory(int id) => _send('DELETE', '/categories/$id');

  Future<void> reorderCategories(List<int> ids) => _send('POST', '/categories/reorder', body: {'ids': ids});

  // ----- TODO -----

  Future<Todo> createTodo({required int categoryId, required String date, required String title}) async =>
      Todo.fromJson((await _send('POST', '/todos',
          body: {'categoryId': categoryId, 'date': date, 'title': title})) as Map<String, dynamic>);

  Future<Todo> updateTodo(int id, {String? title, bool? done}) async =>
      Todo.fromJson((await _send('PATCH', '/todos/$id', body: {
        if (title != null) 'title': title,
        if (done != null) 'done': done,
      })) as Map<String, dynamic>);

  Future<void> deleteTodo(int id) => _send('DELETE', '/todos/$id');

  // ----- 크루 -----

  Future<List<Profile>> crews() async =>
      ((await _get('/crews')) as List).map((e) => Profile.fromJson(e as Map<String, dynamic>)).toList();

  Future<Profile> createCrew({required String name, String bio = ''}) async =>
      Profile.fromJson((await _send('POST', '/crews', body: {'name': name, 'bio': bio})) as Map<String, dynamic>);

  Future<Profile> joinCrew(String inviteCode) async => Profile.fromJson(
      (await _send('POST', '/crews/join', body: {'inviteCode': inviteCode})) as Map<String, dynamic>);

  Future<({Profile crew, List<Profile> members})> crewDetail(int id) async {
    final res = (await _get('/crews/$id')) as Map<String, dynamic>;
    return (
      crew: Profile.fromJson(res),
      members: (res['members'] as List).map((e) => Profile.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Future<Profile> updateCrew(int id, {String? name, String? bio, String? avatarUrl}) async =>
      Profile.fromJson((await _send('PATCH', '/crews/$id', body: {
        if (name != null) 'name': name,
        if (bio != null) 'bio': bio,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      })) as Map<String, dynamic>);

  Future<void> leaveCrew(int id) => _send('POST', '/crews/$id/leave');

  // ----- 친구 -----

  Future<FriendBook> friends() async => FriendBook.fromJson((await _get('/friends')) as Map<String, dynamic>);

  Future<List<Profile>> searchUsers(String q) async => ((await _get('/friends/search', {'q': q})) as List)
      .map((e) => Profile.fromJson(e as Map<String, dynamic>))
      .toList();

  Future<String> requestFriend({int? userId, String? handle}) async {
    final res = (await _send('POST', '/friends/request',
        body: {if (userId != null) 'userId': userId, if (handle != null) 'handle': handle})) as Map<String, dynamic>;
    return res['status'] as String;
  }

  Future<void> acceptFriend(int friendshipId) => _send('POST', '/friends/$friendshipId/accept');

  Future<void> removeFriend(int friendshipId) => _send('DELETE', '/friends/$friendshipId');
}
