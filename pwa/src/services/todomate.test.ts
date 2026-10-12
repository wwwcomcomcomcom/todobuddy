import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { palette } from '../lib/colors';
import {
  androidColorToHex, decodeFirestoreFields, decodeFirestoreValue, TodoMateClient, TodoMateError, type TodoMateConfig,
} from './todomate';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SIGN_IN_OK = { idToken: 'id-token', localId: 'uid-1' };
const KEY_INVALID = {
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
  },
};

/** 요청을 기록하는 가짜 fetch. 라우팅은 handler 가 한다. */
function fakeFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return handler(url, init);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const configs = (...list: TodoMateConfig[]) => {
  const getConfig = vi.fn(async (refresh: boolean) => list[Math.min(refresh ? 1 : 0, list.length - 1)]);
  return getConfig;
};

// ----- Firestore 문서 만들기 -----

type FsValue = Record<string, unknown>;
const str = (v: string): FsValue => ({ stringValue: v });
const int = (v: number): FsValue => ({ integerValue: String(v) });
const bool = (v: boolean): FsValue => ({ booleanValue: v });
const doc = (collection: string, id: string, fields: Record<string, FsValue>) => ({
  document: { name: `projects/p/databases/(default)/documents/${collection}/${id}`, fields },
  readTime: '2026-10-08T00:00:00Z',
});
const ms = (s: string, hourUtc = 0) => Date.parse(`${s}T${String(hourUtc).padStart(2, '0')}:00:00Z`);

/** 로그인 + runQuery(Goal, TodoItem) 를 흉내 내는 서버. */
function firebase({ goals, todos }: { goals: unknown[]; todos: unknown[] }) {
  return fakeFetch((url, init) => {
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) return json(SIGN_IN_OK);
    if (url.endsWith(':runQuery')) {
      const body = JSON.parse(String(init.body));
      const collection = body.structuredQuery.from[0].collectionId;
      return json(collection === 'Goal' ? goals : todos);
    }
    return json({}, 404);
  });
}

async function signedIn(server: ReturnType<typeof fakeFetch>, projectId = 'mate-914f3') {
  const client = new TodoMateClient({ getConfig: configs({ apiKey: 'k1', projectId }), fetch: server.fetch });
  await client.signIn('me@example.com', 'pw');
  return client;
}

describe('androidColorToHex', () => {
  it('알파를 버리고 #RRGGBB 로 바꾼다', () => {
    expect(androidColorToHex(0xffee8b8b)).toBe('#EE8B8B');
    // 안드로이드 색은 부호 있는 32비트 정수로 저장된다.
    expect(androidColorToHex(-1143925)).toBe('#EE8B8B');
    expect(androidColorToHex(0x0000ff)).toBe('#0000FF');
    expect(androidColorToHex(-1)).toBe('#FFFFFF');
  });

  it('색이 없으면 팔레트 첫 색', () => {
    expect(androidColorToHex(null)).toBe(palette[0]);
    expect(androidColorToHex(undefined)).toBe(palette[0]);
  });
});

describe('signIn', () => {
  it('서버가 준 키로 Firebase Auth 에 직접 로그인한다', async () => {
    const server = fakeFetch(() => json(SIGN_IN_OK));
    const getConfig = configs({ apiKey: 'key-123', projectId: 'mate-914f3' });
    const client = new TodoMateClient({ getConfig, fetch: server.fetch });

    await client.signIn('me@example.com', 'secret');

    expect(getConfig).toHaveBeenCalledTimes(1);
    expect(getConfig).toHaveBeenCalledWith(false);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].url).toBe('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=key-123');
    expect(server.calls[0].init.method).toBe('POST');
    expect(server.calls[0].body).toEqual({ email: 'me@example.com', password: 'secret', returnSecureToken: true });
    expect(client.isSignedIn).toBe(true);
  });

  it('비밀번호가 틀리면 안내 문구를 보여준다', async () => {
    for (const message of ['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND']) {
      const server = fakeFetch(() => json({ error: { code: 400, message } }, 400));
      const getConfig = configs({ apiKey: 'k', projectId: 'p' });
      const client = new TodoMateClient({ getConfig, fetch: server.fetch });

      const err = await client.signIn('me@example.com', 'wrong').catch((e) => e);
      expect(err).toBeInstanceOf(TodoMateError);
      expect(err.message).toBe(
        '이메일 또는 비밀번호가 올바르지 않아요.\n구글·애플 로그인 계정이라면 투두메이트 앱 설정에서 비밀번호를 먼저 연결해 주세요.',
      );
      // 비밀번호 오류는 키 갱신 대상이 아니다.
      expect(getConfig).toHaveBeenCalledTimes(1);
      expect(server.calls).toHaveLength(1);
      expect(client.isSignedIn).toBe(false);
    }
  });

  it('그 밖의 실패는 일반 실패 문구', async () => {
    const server = fakeFetch(() => json({ error: { code: 400, message: 'USER_DISABLED' } }, 400));
    const client = new TodoMateClient({ getConfig: configs({ apiKey: 'k', projectId: 'p' }), fetch: server.fetch });
    await expect(client.signIn('a', 'b')).rejects.toThrow('투두메이트 로그인에 실패했어요.');
  });

  it('키 오류면 설정을 한 번 새로 받아 한 번만 다시 시도한다', async () => {
    const server = fakeFetch((url) => (url.endsWith('key=new-key') ? json(SIGN_IN_OK) : json(KEY_INVALID, 400)));
    const getConfig = configs({ apiKey: 'old-key', projectId: 'p' }, { apiKey: 'new-key', projectId: 'p2' });
    const client = new TodoMateClient({ getConfig, fetch: server.fetch });

    await client.signIn('me@example.com', 'pw');

    expect(getConfig.mock.calls).toEqual([[false], [true]]);
    expect(server.calls.map((c) => c.url.split('?')[1])).toEqual(['key=old-key', 'key=new-key']);
    expect(client.isSignedIn).toBe(true);
  });

  it('새 키로도 키 오류면 더 시도하지 않고 실패한다', async () => {
    const server = fakeFetch(() => json(KEY_INVALID, 400));
    const getConfig = configs({ apiKey: 'a', projectId: 'p' }, { apiKey: 'b', projectId: 'p' });
    const client = new TodoMateClient({ getConfig, fetch: server.fetch });

    await expect(client.signIn('me@example.com', 'pw')).rejects.toThrow('투두메이트 로그인에 실패했어요.');
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(server.calls).toHaveLength(2);
  });

  it('메시지만 있는 키 오류(API_KEY_INVALID)도 알아본다', async () => {
    let n = 0;
    const server = fakeFetch(() => (n++ === 0 ? json({ error: { code: 400, message: 'API_KEY_INVALID' } }, 400) : json(SIGN_IN_OK)));
    const getConfig = configs({ apiKey: 'a', projectId: 'p' }, { apiKey: 'b', projectId: 'p' });
    await new TodoMateClient({ getConfig, fetch: server.fetch }).signIn('a', 'b');
    expect(getConfig.mock.calls).toEqual([[false], [true]]);
  });

  it('설정을 못 받으면 연결 실패, 모양이 이상하면 설정 오류', async () => {
    const server = fakeFetch(() => json(SIGN_IN_OK));
    const failing = new TodoMateClient({ getConfig: () => Promise.reject(new Error('boom')), fetch: server.fetch });
    await expect(failing.signIn('a', 'b')).rejects.toThrow('투두메이트 서버에 연결하지 못했어요.');

    const broken = new TodoMateClient({
      getConfig: async () => ({ apiKey: '', projectId: 'p' }),
      fetch: server.fetch,
    });
    await expect(broken.signIn('a', 'b')).rejects.toThrow('투두메이트 설정을 읽지 못했어요.');
    expect(server.calls).toHaveLength(0);
  });

  it('TodoBuddy 서버 오류(ApiError)는 그대로 올린다', async () => {
    const apiError = new ApiError(502, 'todomate_unavailable');
    const client = new TodoMateClient({ getConfig: () => Promise.reject(apiError), fetch: fakeFetch(() => json({})).fetch });
    await expect(client.signIn('a', 'b')).rejects.toBe(apiError);
  });

  it('네트워크 오류는 연결 실패 문구', async () => {
    const server = fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const client = new TodoMateClient({ getConfig: configs({ apiKey: 'k', projectId: 'p' }), fetch: server.fetch });
    await expect(client.signIn('a', 'b')).rejects.toThrow('투두메이트 서버에 연결하지 못했어요.');
  });
});

describe('Firestore 값 풀기', () => {
  it('타입 붙은 값을 평범한 값으로', () => {
    expect(decodeFirestoreValue({ nullValue: null })).toBeNull();
    expect(decodeFirestoreValue({ booleanValue: true })).toBe(true);
    expect(decodeFirestoreValue({ integerValue: '1759881600000' })).toBe(1759881600000);
    expect(decodeFirestoreValue({ integerValue: '-1143925' })).toBe(-1143925);
    expect(decodeFirestoreValue({ doubleValue: 1.5 })).toBe(1.5);
    expect(decodeFirestoreValue({ stringValue: '운동' })).toBe('운동');
    expect(decodeFirestoreValue({ timestampValue: '2026-10-08T00:00:00Z' })).toBe('2026-10-08T00:00:00Z');
    expect(decodeFirestoreValue({ geoPointValue: { latitude: 1, longitude: 2 } })).toBeNull();
  });

  it('mapValue 와 arrayValue 는 안쪽까지 푼다', () => {
    expect(
      decodeFirestoreFields({
        meta: { mapValue: { fields: { n: int(3), tags: { arrayValue: { values: [str('a'), bool(false), { nullValue: null }] } } } } },
        empty: { mapValue: {} },
        none: { arrayValue: {} },
      }),
    ).toEqual({ meta: { n: 3, tags: ['a', false, null] }, empty: {}, none: [] });
  });
});

describe('fetchSchedules', () => {
  it('로그인 전에는 막는다', async () => {
    const client = new TodoMateClient({ getConfig: configs({ apiKey: 'k', projectId: 'p' }), fetch: fakeFetch(() => json([])).fetch });
    await expect(client.fetchSchedules('2026-10-01', '2026-10-31')).rejects.toThrow('먼저 로그인해 주세요.');
  });

  it('설정의 projectId 로 본인 문서만 질의한다', async () => {
    const server = firebase({ goals: [], todos: [{ readTime: 'x' }] });
    const client = await signedIn(server, 'other-project');
    expect(await client.fetchSchedules('2026-10-01', '2026-10-31')).toEqual([]);

    const queries = server.calls.slice(1);
    expect(queries.map((c) => c.url)).toEqual([
      'https://firestore.googleapis.com/v1/projects/other-project/databases/(default)/documents:runQuery',
      'https://firestore.googleapis.com/v1/projects/other-project/databases/(default)/documents:runQuery',
    ]);
    expect((queries[0].init.headers as Record<string, string>).authorization).toBe('Bearer id-token');
    expect(queries[0].body).toEqual({
      structuredQuery: {
        from: [{ collectionId: 'Goal' }],
        where: { fieldFilter: { field: { fieldPath: 'userID' }, op: 'EQUAL', value: { stringValue: 'uid-1' } } },
      },
    });
    expect((queries[1].body as { structuredQuery: { where: { fieldFilter: { field: { fieldPath: string } } } } }).structuredQuery.where.fieldFilter.field.fieldPath).toBe('writerID');
  });

  it('기간(양끝 포함)으로 거르고, Goal 별로 묶고, 날짜순으로 정렬한다', async () => {
    const server = firebase({
      goals: [
        doc('Goal', 'g-run', { title: str('달리기'), color: int(-1143925), visibility: str('public') }),
        doc('Goal', 'g-study', { title: str('공부'), color: int(0xff7bc47f), visibility: str('private') }),
        doc('Goal', 'g-friends', { title: str('친구공개'), visibility: str('friends') }),
      ],
      todos: [
        doc('TodoItem', 't1', { content: str('  5km  '), date: int(ms('2026-10-03')), goalID: str('g-run'), completed: bool(true) }),
        doc('TodoItem', 't2', { content: str('시작일'), date: int(ms('2026-10-01')), goalID: str('g-run') }),
        doc('TodoItem', 't3', { content: str('종료일'), date: int(ms('2026-10-31')), goalID: str('g-study'), completed: bool(false) }),
        doc('TodoItem', 't4', { content: str('범위 전'), date: int(ms('2026-09-30', 23)), goalID: str('g-run') }),
        doc('TodoItem', 't5', { content: str('범위 후'), date: int(ms('2026-10-31', 1)), goalID: str('g-run') }),
        doc('TodoItem', 't6', { content: str('목표 없음'), date: int(ms('2026-10-10')), goalID: { nullValue: null } }),
        doc('TodoItem', 't7', { content: str('날짜 없음'), goalID: str('g-run') }),
        doc('TodoItem', 't8', { content: str('지워진 목표'), date: int(ms('2026-10-05')), goalID: str('g-gone') }),
        doc('TodoItem', 't9', { content: str('세분화된 공개'), date: int(ms('2026-10-06')), goalID: str('g-friends') }),
      ],
    });
    const client = await signedIn(server);

    const result = await client.fetchSchedules('2026-10-01', '2026-10-31');

    expect(result).toEqual([
      {
        name: '달리기',
        androidColor: -1143925,
        isPrivate: false,
        todos: [
          { title: '시작일', date: '2026-10-01', completed: false },
          { title: '5km', date: '2026-10-03', completed: true },
        ],
      },
      { name: '공부', androidColor: 0xff7bc47f, isPrivate: true, todos: [{ title: '종료일', date: '2026-10-31', completed: false }] },
      {
        name: '(미분류)',
        androidColor: null,
        isPrivate: true,
        todos: [
          { title: '지워진 목표', date: '2026-10-05', completed: false },
          { title: '목표 없음', date: '2026-10-10', completed: false },
        ],
      },
      // 투두메이트의 세분화된 공개 대상은 모두 '공개' 로 본다 (비공개만 비공개).
      { name: '친구공개', androidColor: null, isPrivate: false, todos: [{ title: '세분화된 공개', date: '2026-10-06', completed: false }] },
    ]);
  });

  it('날짜는 ms 타임스탬프의 UTC 날짜다', async () => {
    const server = firebase({
      goals: [],
      // 한국 시간 2026-10-10 00:00 은 UTC 로 2026-10-09 15:00 이다.
      todos: [doc('TodoItem', 't', { content: str('자정'), date: int(ms('2026-10-09', 15)) })],
    });
    const client = await signedIn(server);
    const [category] = await client.fetchSchedules('2026-10-01', '2026-10-31');
    expect(category.todos[0].date).toBe('2026-10-09');
  });

  it('질의가 실패하면 가져오기 실패 문구', async () => {
    const server = fakeFetch((url) => (url.includes('identitytoolkit') ? json(SIGN_IN_OK) : json({ error: {} }, 403)));
    const client = await signedIn(server);
    await expect(client.fetchSchedules('2026-10-01', '2026-10-31')).rejects.toThrow('투두메이트에서 일정을 가져오지 못했어요.');
  });
});
