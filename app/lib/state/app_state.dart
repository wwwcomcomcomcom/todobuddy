import 'package:flutter/foundation.dart' hide Category;
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/google_sign_in.dart';
import '../models/models.dart';

String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime parseYmd(String s) => DateTime.parse(s);

enum AuthStatus { unknown, signedOut, signedIn }

/// 화면 전체가 공유하는 단 하나의 상태. 화면들은 여기에만 의존한다.
class AppState extends ChangeNotifier {
  AppState({ApiClient? api}) : api = api ?? ApiClient();

  final ApiClient api;
  static const _tokenKey = 'todobuddy.token';

  AuthStatus status = AuthStatus.unknown;
  Profile? me;

  List<Profile> crews = const [];
  FriendBook friendBook = const FriendBook();

  /// `me` | `user:<id>` | `crew:<id>`
  String scope = 'me';
  DateTime selectedDate = DateTime.now();
  DateTime visibleMonth = DateTime(DateTime.now().year, DateTime.now().month);

  Board? board;
  Map<String, List<DaySegment>> calendar = const {};

  bool loadingBoard = false;
  String? errorMessage;

  bool get isOwnScope => scope == 'me';

  /// 상단 칩 줄에 올릴 대상들: 나 → 크루 → 친구 순서.
  List<Profile> get scopeTargets => [
        if (me != null) me!,
        ...crews,
        ...friendBook.friends.map((f) => f.profile),
      ];

  // ----- 인증 -----

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    if (token == null) {
      status = AuthStatus.signedOut;
      notifyListeners();
      return;
    }
    api.token = token;
    try {
      me = await api.me();
      status = AuthStatus.signedIn;
      notifyListeners();
      await refreshAll();
    } on ApiException {
      await signOut();
    }
  }

  Future<void> signInWithGoogle() async {
    final config = await api.authConfig();
    final clientId = (config['googleClientId'] as String?) ?? '';
    if (clientId.isEmpty) throw const GoogleSignInException('서버에 GOOGLE_CLIENT_ID 가 설정돼 있지 않아요.');

    final grant = await GoogleLoopbackSignIn(clientId: clientId).authorize();
    final result = await api.loginWithGoogle(
      code: grant.code,
      codeVerifier: grant.codeVerifier,
      redirectUri: grant.redirectUri,
    );
    await _completeSignIn(result.token, result.user);
  }

  Future<void> signInAsDev(String name) async {
    final result = await api.loginAsDev(name);
    await _completeSignIn(result.token, result.user);
  }

  Future<void> _completeSignIn(String token, Profile user) async {
    api.token = token;
    me = user;
    status = AuthStatus.signedIn;
    (await SharedPreferences.getInstance()).setString(_tokenKey, token);
    scope = 'me';
    notifyListeners();
    await refreshAll();
  }

  Future<void> signOut() async {
    api.token = null;
    me = null;
    board = null;
    calendar = const {};
    crews = const [];
    friendBook = const FriendBook();
    scope = 'me';
    status = AuthStatus.signedOut;
    (await SharedPreferences.getInstance()).remove(_tokenKey);
    notifyListeners();
  }

  // ----- 데이터 새로고침 -----

  Future<void> refreshAll() async {
    await refreshPeople();
    await refreshBoard();
  }

  Future<void> refreshPeople() async {
    if (status != AuthStatus.signedIn) return;
    try {
      final results = await Future.wait([api.crews(), api.friends()]);
      crews = results[0] as List<Profile>;
      friendBook = results[1] as FriendBook;
      // 보고 있던 대상과의 관계가 끊겼다면 내 보드로 돌아온다.
      if (!isOwnScope && !scopeTargets.any((p) => p.scope == scope)) scope = 'me';
      notifyListeners();
    } on ApiException catch (e) {
      _fail(e);
    }
  }

  Future<void> refreshBoard() async {
    if (status != AuthStatus.signedIn) return;
    loadingBoard = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        api.board(scope: scope, date: ymd(selectedDate)),
        api.calendar(scope: scope, year: visibleMonth.year, month: visibleMonth.month),
      ]);
      board = results[0] as Board;
      calendar = results[1] as Map<String, List<DaySegment>>;
      errorMessage = null;
    } on ApiException catch (e) {
      _fail(e);
    } finally {
      loadingBoard = false;
      notifyListeners();
    }
  }

  // ----- 탐색 -----

  Future<void> selectScope(String next) async {
    if (scope == next) return;
    scope = next;
    board = null;
    notifyListeners();
    await refreshBoard();
  }

  Future<void> selectDate(DateTime date) async {
    selectedDate = date;
    if (date.year != visibleMonth.year || date.month != visibleMonth.month) {
      visibleMonth = DateTime(date.year, date.month);
    }
    notifyListeners();
    await refreshBoard();
  }

  Future<void> showMonth(DateTime month) async {
    visibleMonth = DateTime(month.year, month.month);
    notifyListeners();
    await refreshBoard();
  }

  // ----- TODO 편집 -----

  Future<void> addTodo(int categoryId, String title) async {
    await _guard(() => api.createTodo(categoryId: categoryId, date: ymd(selectedDate), title: title));
  }

  /// 체크박스는 먼저 화면을 바꾸고 나중에 서버와 맞춘다.
  Future<void> toggleTodo(Todo todo) async {
    _replaceTodoLocally(todo.copyWith(done: !todo.done));
    notifyListeners();
    await _guard(() => api.updateTodo(todo.id, done: !todo.done), silentRefresh: true);
  }

  Future<void> renameTodo(Todo todo, String title) async {
    await _guard(() => api.updateTodo(todo.id, title: title));
  }

  Future<void> deleteTodo(Todo todo) async {
    await _guard(() => api.deleteTodo(todo.id));
  }

  void _replaceTodoLocally(Todo updated) {
    final current = board;
    if (current == null) return;
    board = Board(
      date: current.date,
      profile: current.profile,
      categories: [
        for (final c in current.categories)
          if (c.id != updated.categoryId)
            c
          else
            Category(
              id: c.id, name: c.name, color: c.color, visibility: c.visibility,
              ownerId: c.ownerId, ownerName: c.ownerName, ownerAvatarUrl: c.ownerAvatarUrl,
              editable: c.editable, shares: c.shares,
              todos: [for (final t in c.todos) t.id == updated.id ? updated : t],
            ),
      ],
    );
  }

  // ----- 카테고리 / 프로필 -----

  Future<void> saveCategory({
    int? id,
    required String name,
    required String color,
    required CategoryVisibility visibility,
    required List<ShareTarget> shares,
  }) async {
    await _guard(() => id == null
        ? api.createCategory(name: name, color: color, visibility: visibility, shares: shares)
        : api.updateCategory(id, name: name, color: color, visibility: visibility, shares: shares));
  }

  Future<void> deleteCategory(int id) => _guard(() => api.deleteCategory(id));

  Future<void> reorderCategories(List<int> ids) => _guard(() => api.reorderCategories(ids));

  Future<void> updateProfile({String? name, String? bio, String? avatarUrl}) async {
    await _guard(() async {
      me = await api.updateMe(name: name, bio: bio, avatarUrl: avatarUrl);
    });
  }

  // ----- 크루 / 친구 -----

  Future<Profile> createCrew(String name) async {
    final crew = await api.createCrew(name: name);
    await refreshPeople();
    return crew;
  }

  Future<Profile> joinCrew(String code) async {
    final crew = await api.joinCrew(code);
    await refreshPeople();
    return crew;
  }

  Future<void> leaveCrew(int id) async {
    await api.leaveCrew(id);
    await refreshPeople();
    if (scope == 'crew:$id') await selectScope('me');
  }

  Future<String> requestFriend({int? userId, String? handle}) async {
    final status = await api.requestFriend(userId: userId, handle: handle);
    await refreshPeople();
    return status;
  }

  Future<void> acceptFriend(int friendshipId) async {
    await api.acceptFriend(friendshipId);
    await refreshPeople();
  }

  Future<void> removeFriend(int friendshipId) async {
    await api.removeFriend(friendshipId);
    await refreshPeople();
  }

  /// 쓰기 요청을 보내고 보드를 다시 읽는다. 실패하면 메시지를 남긴다.
  Future<void> _guard(Future<void> Function() action, {bool silentRefresh = false}) async {
    try {
      await action();
      errorMessage = null;
    } on ApiException catch (e) {
      _fail(e);
    }
    if (!silentRefresh) await refreshBoard();
  }

  void _fail(ApiException e) {
    errorMessage = e.message;
    if (e.statusCode == 401) signOut();
    notifyListeners();
  }
}
