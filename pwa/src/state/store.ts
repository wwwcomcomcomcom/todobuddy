import { Api, ApiError } from '../lib/api';
import { addDays, monthOf, sameMonth, todayYmd, type YearMonth } from '../lib/date';
import {
  emptyFriendBook, profileScope,
  type Board, type Calendar, type Category, type CategoryVisibility, type FriendBook, type Profile, type ShareTarget, type Todo,
} from '../lib/models';

/** `offline` 은 세션을 확인하려다 서버에 닿지 못한 상태다. */
export type AuthStatus = 'unknown' | 'signedOut' | 'signedIn' | 'offline';

export interface AppSnapshot {
  status: AuthStatus;
  me: Profile | null;
  crews: Profile[];
  friendBook: FriendBook;
  /** `me` | `user:<id>` | `crew:<id>` */
  scope: string;
  selectedDate: string;
  visibleMonth: YearMonth;
  board: Board | null;
  calendar: Calendar;
  loadingBoard: boolean;
  errorMessage: string | null;
}

export const isOwnScope = (s: AppSnapshot) => s.scope === 'me';

/** 상단 칩 줄에 올릴 대상들: 나 → 크루 → 친구 순서. */
export const scopeTargets = (s: AppSnapshot): Profile[] => [...(s.me ? [s.me] : []), ...s.crews, ...s.friendBook.friends];

/** 칩이 가리키는 스코프. 첫 칩(나)은 `me` 다. */
export const scopeOf = (s: AppSnapshot, p: Profile) => (s.me && p.type === 'user' && p.id === s.me.id ? 'me' : profileScope(p));

function initialSnapshot(): AppSnapshot {
  const today = todayYmd();
  return {
    status: 'unknown',
    me: null,
    crews: [],
    friendBook: emptyFriendBook,
    scope: 'me',
    selectedDate: today,
    visibleMonth: monthOf(today),
    board: null,
    calendar: {},
    loadingBoard: false,
    errorMessage: null,
  };
}

/**
 * 화면 전체가 공유하는 단 하나의 상태. 화면들은 여기에만 의존한다 (Flutter 의 AppState 를 옮긴 것).
 * 스냅샷은 바뀔 때마다 새 객체라 useSyncExternalStore 로 구독한다.
 */
export class AppStore {
  readonly api: Api;
  private snapshot: AppSnapshot;
  private listeners = new Set<() => void>();
  /** 늦게 도착한 보드 응답이 최신 선택을 덮어쓰지 않게 하는 순번. */
  private boardRequest = 0;

  constructor({ api = new Api(), initial }: { api?: Api; initial?: Partial<AppSnapshot> } = {}) {
    this.api = api;
    this.snapshot = { ...initialSnapshot(), ...initial };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<AppSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  // ----- 인증 -----

  /** 세션 쿠키가 살아 있는지 서버에 묻는다. 토큰은 브라우저가 들고 있고 스크립트는 볼 수 없다. */
  restoreSession = async () => {
    try {
      const me = await this.api.me();
      this.set({ me, status: 'signedIn' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) this.set({ status: 'offline' });
      else this.reset();
    }
  };

  signInAsDev = async (name: string) => {
    const { user } = await this.api.loginAsDev(name);
    // 보던 날짜·달은 그대로 두고, 남의 데이터가 남지 않게 사람·보드만 비운다.
    this.set({ me: user, status: 'signedIn', scope: 'me', board: null, calendar: {}, crews: [], friendBook: emptyFriendBook, errorMessage: null });
  };

  /** 구글 로그인은 서버가 주도하는 리다이렉트다. 돌아오면 restoreSession 이 이어받는다. */
  signInWithGoogle = () => {
    window.location.assign('/api/auth/google/start');
  };

  signOut = async () => {
    try {
      await this.api.logout();
    } catch {
      // 쿠키를 못 지웠어도 화면은 로그인으로 돌린다. 다음 요청에서 다시 401 이 난다.
    }
    this.reset();
  };

  /** 로그인 정보와 남의 데이터를 비운다. 보던 날짜는 그대로 둔다 (Flutter 앱과 같다). */
  private reset() {
    const { selectedDate, visibleMonth } = this.snapshot;
    this.set({ ...initialSnapshot(), selectedDate, visibleMonth, status: 'signedOut' });
  }

  // ----- 데이터 새로고침 -----

  refreshAll = async () => {
    await this.refreshPeople();
    await this.refreshBoard();
  };

  refreshPeople = async () => {
    if (this.snapshot.status !== 'signedIn') return;
    try {
      const [crews, friendBook] = await Promise.all([this.api.crews(), this.api.friends()]);
      const next = { ...this.snapshot, crews, friendBook };
      // 보고 있던 대상과의 관계가 끊겼다면 내 보드로 돌아온다.
      const stillThere = next.scope === 'me' || scopeTargets(next).some((p) => profileScope(p) === next.scope);
      this.set({ crews, friendBook, ...(stillThere ? {} : { scope: 'me', board: null }) });
    } catch (e) {
      this.fail(e);
    }
  };

  refreshBoard = async () => {
    if (this.snapshot.status !== 'signedIn') return;
    const request = ++this.boardRequest;
    const { scope, selectedDate, visibleMonth } = this.snapshot;
    this.set({ loadingBoard: true });
    try {
      const [board, calendar] = await Promise.all([
        this.api.board(scope, selectedDate),
        this.api.calendar(scope, visibleMonth.year, visibleMonth.month),
      ]);
      if (request !== this.boardRequest) return;
      this.set({ board, calendar, errorMessage: null });
    } catch (e) {
      if (request === this.boardRequest) this.fail(e);
    } finally {
      if (request === this.boardRequest) this.set({ loadingBoard: false });
    }
  };

  // ----- 탐색 -----

  selectScope = async (next: string) => {
    if (this.snapshot.scope === next) return;
    this.set({ scope: next, board: null, calendar: {} });
    await this.refreshBoard();
  };

  selectDate = async (date: string) => {
    const month = monthOf(date);
    this.set({ selectedDate: date, ...(sameMonth(month, this.snapshot.visibleMonth) ? {} : { visibleMonth: month }) });
    await this.refreshBoard();
  };

  goToday = () => this.selectDate(todayYmd());

  shiftDate = (days: number) => this.selectDate(addDays(this.snapshot.selectedDate, days));

  showMonth = async (month: YearMonth) => {
    this.set({ visibleMonth: month });
    await this.refreshBoard();
  };

  // ----- TODO 편집 -----

  addTodo = (categoryId: number, title: string) =>
    this.guard(() => this.api.createTodo({ categoryId, date: this.snapshot.selectedDate, title }));

  /** 체크박스는 먼저 화면을 바꾸고 나중에 서버와 맞춘다. */
  toggleTodo = async (todo: Todo) => {
    this.replaceTodoLocally({ ...todo, done: !todo.done });
    await this.guard(() => this.api.updateTodo(todo.id, { done: !todo.done }));
  };

  renameTodo = (todo: Todo, title: string) => this.guard(() => this.api.updateTodo(todo.id, { title }));

  deleteTodo = (todo: Todo) => this.guard(() => this.api.deleteTodo(todo.id));

  private replaceTodoLocally(updated: Todo) {
    const board = this.snapshot.board;
    if (!board) return;
    this.set({
      board: {
        ...board,
        categories: board.categories.map((c): Category =>
          c.id !== updated.categoryId ? c : { ...c, todos: (c.todos ?? []).map((t) => (t.id === updated.id ? updated : t)) }),
      },
    });
  }

  // ----- 카테고리 / 프로필 -----

  saveCategory = (input: { id?: number; name: string; color: string; visibility: CategoryVisibility; shares: ShareTarget[] }) => {
    const { id, ...body } = input;
    return this.guard(() => (id == null ? this.api.createCategory(body) : this.api.updateCategory(id, body)));
  };

  deleteCategory = (id: number) => this.guard(() => this.api.deleteCategory(id));

  reorderCategories = (ids: number[]) => this.guard(() => this.api.reorderCategories(ids));

  updateProfile = (patch: { name?: string; bio?: string; avatarUrl?: string | null }) =>
    this.guard(async () => {
      this.set({ me: await this.api.updateMe(patch) });
    });

  // ----- 크루 / 친구 (실패는 호출한 화면이 메시지로 보여준다) -----

  createCrew = async (name: string) => {
    const crew = await this.api.createCrew(name);
    await this.refreshPeople();
    return crew;
  };

  joinCrew = async (code: string) => {
    const crew = await this.api.joinCrew(code);
    await this.refreshPeople();
    return crew;
  };

  leaveCrew = async (id: number) => {
    await this.api.leaveCrew(id);
    await this.refreshPeople();
    if (this.snapshot.scope === `crew:${id}`) await this.selectScope('me');
  };

  requestFriend = async (target: { userId?: number; handle?: string }) => {
    const status = await this.api.requestFriend(target);
    await this.refreshPeople();
    return status;
  };

  acceptFriend = async (friendshipId: number) => {
    await this.api.acceptFriend(friendshipId);
    await this.refreshPeople();
  };

  removeFriend = async (friendshipId: number) => {
    await this.api.removeFriend(friendshipId);
    await this.refreshPeople();
  };

  /** 쓰기 요청을 보내고 보드를 다시 읽는다. 실패하면 메시지를 남긴다. 성공 여부를 돌려준다. */
  private async guard(action: () => Promise<unknown>): Promise<boolean> {
    let ok = true;
    try {
      await action();
      this.set({ errorMessage: null });
    } catch (e) {
      ok = false;
      this.fail(e);
    }
    await this.refreshBoard();
    return ok;
  }

  /** 화면 밖에서 난 401 도 여기로 모은다. */
  handleError = (e: unknown) => this.fail(e);

  private fail(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      this.reset();
      this.set({ errorMessage: e.message });
      return;
    }
    this.set({ errorMessage: e instanceof ApiError ? e.message : '요청을 처리하지 못했어요.' });
  }
}
