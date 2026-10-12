import type {
  AuthConfig, Board, Calendar, Category, CategoryVisibility, CrewDetail, FriendBook, Profile, Routine,
  RoutineDeletionPreview, RoutineInput, RoutinePreview, ShareTarget, Todo,
} from './models';

const MESSAGES: Record<string, string> = {
  invalid_invite_code: '초대 코드를 찾을 수 없어요.',
  user_not_found: '그런 사용자를 찾지 못했어요.',
  cannot_friend_self: '자기 자신에게는 친구 요청을 보낼 수 없어요.',
  owner_must_transfer_or_empty_crew: '크루원이 남아 있는 동안에는 방장이 나갈 수 없어요.',
  google_oauth_not_configured: '서버에 구글 로그인 설정이 없어요.',
  unauthorized: '로그인이 만료되었어요. 다시 로그인해 주세요.',
  routine_changed: '다른 곳에서 수정된 반복 일정이에요. 목록으로 돌아가 다시 열어 주세요.',
  routine_date_changed: '날짜가 바뀌었어요. 삭제할 기록을 다시 확인해 주세요.',
  image_too_large: '이미지가 너무 커요. 5MB 이하로 올려주세요.',
  unsupported_image_type: 'png, jpg, gif, webp 만 올릴 수 있어요.',
  todomate_unavailable: '투두메이트 서버에 연결하지 못했어요.',
  network: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(status: number, code: string, detail?: string) {
    // 사용자에게 그대로 보여줄 수 있는 한국어 메시지.
    super(MESSAGES[code] ?? detail ?? `요청을 처리하지 못했어요. (${code})`);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/** 오류를 화면에 보여줄 문장으로. */
export const errorMessage = (e: unknown, fallback = '요청을 처리하지 못했어요.') =>
  e instanceof ApiError ? e.message : fallback;

type Query = Record<string, string | number | undefined>;

/**
 * TodoBuddy 서버와 이야기하는 유일한 통로.
 * 같은 출처의 `/api` 로 보내고, 인증은 브라우저가 httpOnly 세션 쿠키로 알아서 붙인다.
 */
export class Api {
  private readonly fetchImpl: typeof fetch;
  private readonly base: string;

  constructor({ fetch: fetchImpl, base = '/api' }: { fetch?: typeof fetch; base?: string } = {}) {
    this.fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.base = base;
  }

  async send<T = unknown>(method: string, path: string, { body, query }: { body?: unknown; query?: Query } = {}): Promise<T> {
    const qs = query
      ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`
      : '';
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}${qs}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network');
    }

    const text = res.status === 204 ? '' : await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const err = (data ?? {}) as { error?: string; detail?: string };
      throw new ApiError(res.status, err.error ?? `http_${res.status}`, err.detail);
    }
    return data as T;
  }

  private get = <T>(path: string, query?: Query) => this.send<T>('GET', path, { query });

  // ----- 인증 -----

  authConfig = () => this.get<AuthConfig>('/auth/config');
  loginAsDev = (name: string) => this.send<{ user: Profile }>('POST', '/auth/dev', { body: { name } });
  logout = () => this.send<void>('POST', '/auth/logout');
  me = () => this.get<Profile>('/auth/me');
  updateMe = (patch: { name?: string; bio?: string; avatarUrl?: string | null }) =>
    this.send<Profile>('PATCH', '/auth/me', { body: patch });

  /** 이미지를 base64 로 올리고 서버가 저장한 경로를 돌려받는다. */
  uploadImage = async (filename: string, dataBase64: string) =>
    (await this.send<{ url: string }>('POST', '/uploads', { body: { filename, dataBase64 } })).url;

  // ----- 보드 / 캘린더 -----

  board = (scope: string, date: string) => this.get<Board>('/board', { scope, date });

  calendar = async (scope: string, year: number, month: number): Promise<Calendar> => {
    const res = await this.get<{ days: { date: string; segments: Calendar[string] }[] }>('/board/calendar', { scope, year, month });
    return Object.fromEntries((res.days ?? []).map((d) => [d.date, d.segments]));
  };

  // ----- 카테고리 -----

  categories = () => this.get<Category[]>('/categories');
  createCategory = (input: { name: string; color: string; visibility: CategoryVisibility; shares?: ShareTarget[] }) =>
    this.send<Category>('POST', '/categories', { body: { shares: [], ...input } });
  updateCategory = (id: number, patch: { name?: string; color?: string; visibility?: CategoryVisibility; shares?: ShareTarget[] }) =>
    this.send<Category>('PATCH', `/categories/${id}`, { body: patch });
  deleteCategory = (id: number) => this.send<void>('DELETE', `/categories/${id}`);
  reorderCategories = (ids: number[]) => this.send<void>('POST', '/categories/reorder', { body: { ids } });

  // ----- TODO -----

  createTodo = (input: { categoryId: number; date: string; title: string }) => this.send<Todo>('POST', '/todos', { body: input });
  updateTodo = (id: number, patch: { title?: string; done?: boolean }) => this.send<Todo>('PATCH', `/todos/${id}`, { body: patch });
  deleteTodo = (id: number) => this.send<void>('DELETE', `/todos/${id}`);

  // ----- 반복 일정 -----

  routines = () => this.get<Routine[]>('/routines');
  previewRoutine = (input: RoutineInput) => this.send<RoutinePreview>('POST', '/routines/preview', { body: input });
  saveRoutine = (input: RoutineInput, id?: number) =>
    id == null ? this.send<Routine>('POST', '/routines', { body: input }) : this.send<Routine>('PATCH', `/routines/${id}`, { body: input });
  previewRoutineDeletion = (id: number) => this.get<RoutineDeletionPreview>(`/routines/${id}/deletion-preview`);
  deleteRoutine = (id: number, options: { asOfDate: string; keepPastDone: boolean; keepPastUndone: boolean; removeToday: boolean }) =>
    this.send<void>('DELETE', `/routines/${id}`, { body: options });

  // ----- 크루 -----

  crews = () => this.get<Profile[]>('/crews');
  createCrew = (name: string, bio = '') => this.send<Profile>('POST', '/crews', { body: { name, bio } });
  joinCrew = (inviteCode: string) => this.send<Profile>('POST', '/crews/join', { body: { inviteCode } });
  crewDetail = (id: number) => this.get<CrewDetail>(`/crews/${id}`);
  updateCrew = (id: number, patch: { name?: string; bio?: string; avatarUrl?: string }) =>
    this.send<Profile>('PATCH', `/crews/${id}`, { body: patch });
  leaveCrew = (id: number) => this.send<void>('POST', `/crews/${id}/leave`);

  // ----- 친구 -----

  friends = () => this.get<FriendBook>('/friends');
  searchUsers = (q: string) => this.get<Profile[]>('/friends/search', { q });
  requestFriend = async (target: { userId?: number; handle?: string }) =>
    (await this.send<{ status: 'pending' | 'accepted' }>('POST', '/friends/request', { body: target })).status;
  acceptFriend = (friendshipId: number) => this.send<void>('POST', `/friends/${friendshipId}/accept`);
  removeFriend = (friendshipId: number) => this.send<void>('DELETE', `/friends/${friendshipId}`);

  // ----- 투두메이트 -----

  todomateConfig = (refresh = false) =>
    this.get<{ apiKey: string; projectId: string }>('/todomate/config', refresh ? { refresh: 1 } : undefined);
}
