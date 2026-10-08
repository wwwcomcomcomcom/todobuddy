import { Api } from '../lib/api';

/**
 * 컴포넌트 테스트용 가짜 TodoBuddy 서버 (app/test/support/fake_server.dart 를 옮긴 것).
 * 실제 서버의 응답 모양을 흉내 내고, 어떤 요청이 왔는지 기록한다.
 */
export const me = { type: 'user', id: 1, name: '하루', bio: '', handle: 'haru', avatarUrl: null };
const friend = { type: 'user', id: 2, name: '민서', bio: '', handle: 'minseo', avatarUrl: null };
const crew = { type: 'crew', id: 1, name: '달리기모임', bio: '같이 달리는 사람들', avatarUrl: null, inviteCode: 'RUNNING1', ownerId: 1, memberCount: 2 };

const owner = { id: 1, name: '하루', avatarUrl: null };

export function boardFixture() {
  return {
    date: '2026-09-15',
    scopeKind: 'user',
    profile: me,
    categories: [
      {
        id: 1, name: '회사에서 할 일', color: '#EE8B8B', visibility: 'private', sortOrder: 0, owner, editable: true, shares: [],
        todos: [{ id: 10, categoryId: 1, date: '2026-09-15', title: '주간 보고서 쓰기', done: true, sortOrder: 0 }],
      },
      {
        id: 2, name: '혼자 하는 일', color: '#F5C543', visibility: 'public', sortOrder: 1, owner, editable: true, shares: [],
        todos: [
          { id: 11, categoryId: 2, date: '2026-09-15', title: '디자인 리뷰 준비', done: false, sortOrder: 0 },
          { id: 12, categoryId: 2, date: '2026-09-15', title: '러닝 30분', done: true, sortOrder: 1 },
        ],
      },
    ],
  };
}

export interface Recorded {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

type Handler = (req: Recorded) => Promise<Response | undefined> | Response | undefined;

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export class FakeServer {
  requests: Recorded[] = [];
  board = boardFixture();
  signedIn = false;
  /** 할 일 쓰기(POST/PATCH) 응답을 늦추고 싶을 때 */
  todoWriteDelay: Promise<void> | null = null;
  interceptor: Handler | null = null;
  private nextTodoId = 13;

  get todoWrites() {
    return this.requests.filter((r) => (r.method === 'POST' && r.path === '/todos') || (r.method === 'PATCH' && r.path.startsWith('/todos/')));
  }

  /** 'GET /board' 같은 꼴의 요청 목록 */
  get log() {
    return this.requests.map((r) => `${r.method} ${r.path}`);
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input), 'http://test.local');
    const req: Recorded = {
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.replace(/^\/api/, ''),
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    this.requests.push(req);
    const intercepted = await this.interceptor?.(req);
    if (intercepted) return intercepted;
    if (this.todoWrites.includes(req)) await this.todoWriteDelay;
    return this.handle(req);
  };

  api() {
    return new Api({ fetch: this.fetch });
  }

  private handle(req: Recorded): Response {
    const key = `${req.method} ${req.path}`;
    switch (key) {
      case 'GET /auth/config':
        return json({ googleEnabled: false, googleWebEnabled: false, devLoginEnabled: true });
      case 'POST /auth/dev':
        this.signedIn = true;
        return json({ token: 'test-token', user: me });
      case 'POST /auth/logout':
        this.signedIn = false;
        return json(undefined, 204);
      case 'GET /auth/me':
        return this.signedIn ? json(me) : json({ error: 'unauthorized' }, 401);
      case 'GET /crews':
        return json([crew]);
      case 'GET /friends':
        return json({ friends: [{ ...friend, friendshipId: 7 }], incoming: [], outgoing: [] });
      case 'GET /board':
        return json(this.board);
      case 'GET /board/calendar':
        return json({
          year: 2026,
          month: 9,
          days: [
            {
              date: '2026-09-15',
              segments: [
                { categoryId: 1, color: '#EE8B8B', total: 1, done: 1 },
                { categoryId: 2, color: '#F5C543', total: 2, done: 1 },
              ],
            },
          ],
        });
      case 'POST /todos': {
        const input = req.body as { categoryId: number; date: string; title: string };
        const category = this.board.categories.find((c) => c.id === input.categoryId)!;
        const todo = { id: this.nextTodoId++, ...input, done: false, sortOrder: category.todos.length };
        category.todos.push(todo);
        return json(todo, 201);
      }
    }
    const todoMatch = req.path.match(/^\/todos\/(\d+)$/);
    if (todoMatch) {
      const id = Number(todoMatch[1]);
      const category = this.board.categories.find((c) => c.todos.some((t) => t.id === id));
      const todo = category?.todos.find((t) => t.id === id);
      if (!category || !todo) return json({ error: 'not_found' }, 404);
      if (req.method === 'PATCH') {
        Object.assign(todo, req.body);
        return json(todo);
      }
      if (req.method === 'DELETE') {
        category.todos = category.todos.filter((t) => t.id !== id);
        return json(undefined, 204);
      }
    }
    return json({ error: 'not_found' }, 404);
  }
}
