import 'package:flutter/material.dart';
import '../theme.dart';

enum CategoryVisibility { private, shared, public }

extension CategoryVisibilityX on CategoryVisibility {
  String get wire => name;

  String get label => switch (this) {
        CategoryVisibility.private => '나만 보기',
        CategoryVisibility.shared => '선택한 크루·친구',
        CategoryVisibility.public => '공개',
      };

  IconData get icon => switch (this) {
        CategoryVisibility.private => Icons.lock_rounded,
        CategoryVisibility.shared => Icons.groups_rounded,
        CategoryVisibility.public => Icons.public_rounded,
      };

  static CategoryVisibility parse(String? value) =>
      CategoryVisibility.values.firstWhere((v) => v.name == value, orElse: () => CategoryVisibility.private);
}

/// 카테고리를 누구에게 공유할지 가리키는 대상.
class ShareTarget {
  const ShareTarget({required this.type, required this.id});

  /// 'crew' 또는 'friend'
  final String type;
  final int id;

  factory ShareTarget.fromJson(Map<String, dynamic> j) =>
      ShareTarget(type: j['targetType'] as String, id: j['targetId'] as int);

  Map<String, dynamic> toJson() => {'targetType': type, 'targetId': id};

  @override
  bool operator ==(Object other) => other is ShareTarget && other.type == type && other.id == id;

  @override
  int get hashCode => Object.hash(type, id);
}

class Profile {
  const Profile({
    required this.type,
    required this.id,
    required this.name,
    this.bio = '',
    this.handle,
    this.avatarUrl,
    this.inviteCode,
    this.ownerId,
    this.memberCount,
  });

  /// 'user' 또는 'crew'
  final String type;
  final int id;
  final String name;
  final String bio;
  final String? handle;
  final String? avatarUrl;
  final String? inviteCode;
  final int? ownerId;
  final int? memberCount;

  bool get isCrew => type == 'crew';

  /// 상단 칩/보드 조회에 쓰는 스코프 문자열.
  String get scope => isCrew ? 'crew:$id' : 'user:$id';

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        type: (j['type'] as String?) ?? 'user',
        id: j['id'] as int,
        name: j['name'] as String,
        bio: (j['bio'] as String?) ?? '',
        handle: j['handle'] as String?,
        avatarUrl: j['avatarUrl'] as String?,
        inviteCode: j['inviteCode'] as String?,
        ownerId: j['ownerId'] as int?,
        memberCount: j['memberCount'] as int?,
      );
}

class Friend {
  const Friend({required this.profile, required this.friendshipId});

  final Profile profile;
  final int friendshipId;

  factory Friend.fromJson(Map<String, dynamic> j) =>
      Friend(profile: Profile.fromJson(j), friendshipId: j['friendshipId'] as int);
}

class FriendBook {
  const FriendBook({this.friends = const [], this.incoming = const [], this.outgoing = const []});

  final List<Friend> friends;

  /// 나에게 온 요청
  final List<Friend> incoming;

  /// 내가 보낸 요청
  final List<Friend> outgoing;

  factory FriendBook.fromJson(Map<String, dynamic> j) {
    List<Friend> parse(String key) =>
        ((j[key] as List?) ?? const []).map((e) => Friend.fromJson(e as Map<String, dynamic>)).toList();
    return FriendBook(friends: parse('friends'), incoming: parse('incoming'), outgoing: parse('outgoing'));
  }
}

class Todo {
  const Todo({
    required this.id,
    required this.categoryId,
    required this.date,
    required this.title,
    required this.done,
  });

  final int id;
  final int categoryId;
  final String date;
  final String title;
  final bool done;

  factory Todo.fromJson(Map<String, dynamic> j) => Todo(
        id: j['id'] as int,
        categoryId: j['categoryId'] as int,
        date: j['date'] as String,
        title: j['title'] as String,
        done: j['done'] as bool,
      );

  Todo copyWith({String? title, bool? done}) => Todo(
        id: id,
        categoryId: categoryId,
        date: date,
        title: title ?? this.title,
        done: done ?? this.done,
      );
}

class Category {
  const Category({
    required this.id,
    required this.name,
    required this.color,
    required this.visibility,
    required this.ownerId,
    this.ownerName,
    this.ownerAvatarUrl,
    this.editable = false,
    this.shares = const [],
    this.todos = const [],
  });

  final int id;
  final String name;
  final Color color;
  final CategoryVisibility visibility;
  final int ownerId;
  final String? ownerName;
  final String? ownerAvatarUrl;

  /// 내 카테고리라서 TODO 를 추가·수정할 수 있는지.
  final bool editable;
  final List<ShareTarget> shares;
  final List<Todo> todos;

  factory Category.fromJson(Map<String, dynamic> j) {
    final owner = (j['owner'] as Map<String, dynamic>?) ?? const {};
    return Category(
      id: j['id'] as int,
      name: j['name'] as String,
      color: hexToColor(j['color'] as String?),
      visibility: CategoryVisibilityX.parse(j['visibility'] as String?),
      ownerId: (owner['id'] as int?) ?? 0,
      ownerName: owner['name'] as String?,
      ownerAvatarUrl: owner['avatarUrl'] as String?,
      editable: (j['editable'] as bool?) ?? false,
      shares: ((j['shares'] as List?) ?? const [])
          .map((e) => ShareTarget.fromJson(e as Map<String, dynamic>))
          .toList(),
      todos: ((j['todos'] as List?) ?? const [])
          .map((e) => Todo.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class Board {
  const Board({required this.date, required this.profile, required this.categories});

  final String date;
  final Profile profile;
  final List<Category> categories;

  factory Board.fromJson(Map<String, dynamic> j) => Board(
        date: j['date'] as String,
        profile: Profile.fromJson(j['profile'] as Map<String, dynamic>),
        categories: ((j['categories'] as List?) ?? const [])
            .map((e) => Category.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// 캘린더 한 칸에 칠할 카테고리별 진행도 한 조각.
class DaySegment {
  const DaySegment({required this.color, required this.total, required this.done});

  final Color color;
  final int total;
  final int done;

  bool get allDone => total > 0 && done == total;
  int get remaining => total - done;

  factory DaySegment.fromJson(Map<String, dynamic> j) => DaySegment(
        color: hexToColor(j['color'] as String?),
        total: j['total'] as int,
        done: j['done'] as int,
      );
}
