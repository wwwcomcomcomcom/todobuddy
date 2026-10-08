// 서버 응답 모양 그대로의 타입. 색은 '#RRGGBB' 문자열로 들고 다닌다.

/** Flutter 의 `Visibility` 위젯과 겹치지 않게 이름 붙였던 도메인 enum 을 그대로 따른다. */
export type CategoryVisibility = 'private' | 'shared' | 'public';

export const visibilityLabel: Record<CategoryVisibility, string> = {
  private: '나만 보기',
  shared: '선택한 크루·친구',
  public: '공개',
};

export interface ShareTarget {
  targetType: 'crew' | 'friend';
  targetId: number;
}

export interface Profile {
  type: 'user' | 'crew';
  id: number;
  name: string;
  bio?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
  inviteCode?: string | null;
  ownerId?: number | null;
  memberCount?: number | null;
}

/** 상단 칩/보드 조회에 쓰는 스코프 문자열. */
export const profileScope = (p: Profile) => (p.type === 'crew' ? `crew:${p.id}` : `user:${p.id}`);

export interface Friend extends Profile {
  friendshipId: number;
}

export interface FriendBook {
  friends: Friend[];
  /** 나에게 온 요청 */
  incoming: Friend[];
  /** 내가 보낸 요청 */
  outgoing: Friend[];
}

export const emptyFriendBook: FriendBook = { friends: [], incoming: [], outgoing: [] };

export interface Todo {
  id: number;
  categoryId: number;
  date: string;
  title: string;
  done: boolean;
  sortOrder?: number;
  routineId?: number | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  visibility: CategoryVisibility;
  sortOrder?: number;
  owner: { id: number; name: string | null; avatarUrl: string | null };
  /** 내 카테고리라서 TODO 를 추가·수정할 수 있는지 (보드 응답에만 있다). */
  editable?: boolean;
  shares?: ShareTarget[];
  todos?: Todo[];
}

export interface Board {
  date: string;
  profile: Profile;
  scopeKind: 'user' | 'crew';
  categories: Category[];
}

/** 캘린더 한 칸에 칠할 카테고리별 진행도 한 조각. */
export interface DaySegment {
  categoryId: number;
  color: string;
  total: number;
  done: number;
}

export type Calendar = Record<string, DaySegment[]>;

export interface AuthConfig {
  googleEnabled: boolean;
  googleWebEnabled?: boolean;
  devLoginEnabled: boolean;
}

export interface RoutineRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weekdays?: number[];
  monthMode?: 'dates' | 'weekdays';
  monthDays?: number[];
  ordinals?: number[];
  overflow?: 'skip' | 'lastDay';
}

export interface Routine {
  id: number;
  categoryId: number;
  versionId: number;
  title: string;
  rule: RoutineRule;
  startDate: string;
  endDate: string | null;
  timeZone: string;
}

export interface RoutineInput {
  title: string;
  categoryId: number | null;
  startDate: string;
  endDate: string | null;
  timeZone: string;
  rule: RoutineRule;
  versionId?: number;
}

export interface RoutinePreview {
  dates: string[];
  today: string;
  timeZone: string;
}

export interface RoutineDeletionPreview {
  today: string;
  pastDone: number;
  pastUndone: number;
  todayCount: number;
}

export interface CrewDetail extends Profile {
  members: Profile[];
}
