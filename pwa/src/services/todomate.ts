import { ApiError } from '../lib/api';
import { palette } from '../lib/colors';

/** 투두메이트 쪽 요청이 실패했을 때, 화면에 그대로 보여줄 수 있는 한국어 메시지를 담는다. */
export class TodoMateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TodoMateError';
  }
}

/** 투두메이트에서 가져온 할 일 한 건. */
export interface TodoMateTodo {
  title: string;
  /** 'YYYY-MM-DD'. 투두메이트가 들고 있는 ms 타임스탬프의 UTC 날짜다. */
  date: string;
  completed: boolean;
}

/** 투두메이트의 Goal(카테고리) 하나와 그 안의 할 일들. */
export interface TodoMateCategory {
  name: string;
  /** 투두메이트가 안드로이드 ARGB 정수로 들고 있는 색. 없으면 null. */
  androidColor: number | null;
  /**
   * 투두메이트는 공개 대상(어떤 친구·크루)까지 세분화돼 있지만, 우리는 공개/비공개
   * 여부만 가져올 수 있다. true 면 투두메이트에서도 비공개였던 카테고리.
   */
  isPrivate: boolean;
  todos: TodoMateTodo[];
}

/** 서버(`GET /api/todomate/config`)가 투두메이트 공개 웹 설정에서 대신 읽어 준 값. */
export interface TodoMateConfig {
  apiKey: string;
  projectId: string;
}

/** 안드로이드 ARGB 정수 색을 '#RRGGBB' 로. 알파는 버린다. 없으면 팔레트 첫 색. */
export const androidColorToHex = (value: number | null | undefined): string =>
  value == null
    ? palette[0]
    : `#${((value & 0xffffff) >>> 0).toString(16).padStart(6, '0').toUpperCase()}`;

const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const firestoreBase = (projectId: string) =>
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;

const MSG_UNREACHABLE = '투두메이트 서버에 연결하지 못했어요.';
const MSG_BAD_CONFIG = '투두메이트 설정을 읽지 못했어요.';
const MSG_WRONG_CREDENTIALS =
  '이메일 또는 비밀번호가 올바르지 않아요.\n구글·애플 로그인 계정이라면 투두메이트 앱 설정에서 비밀번호를 먼저 연결해 주세요.';
const MSG_SIGN_IN_FAILED = '투두메이트 로그인에 실패했어요.';
const MSG_NOT_SIGNED_IN = '먼저 로그인해 주세요.';
const MSG_FETCH_FAILED = '투두메이트에서 일정을 가져오지 못했어요.';

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Firestore REST 의 타입 붙은 값 하나를 평범한 JS 값으로. 모르는 타입은 null. */
export function decodeFirestoreValue(value: Json): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  // int64 는 JSON 에서 문자열로 온다.
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const fields = isObject(value.mapValue) ? value.mapValue.fields : undefined;
    return decodeFirestoreFields(isObject(fields) ? fields : {});
  }
  if ('arrayValue' in value) {
    const values = isObject(value.arrayValue) ? value.arrayValue.values : undefined;
    return Array.isArray(values) ? values.map((v) => (isObject(v) ? decodeFirestoreValue(v) : null)) : [];
  }
  return null;
}

export function decodeFirestoreFields(fields: Json): Json {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, isObject(v) ? decodeFirestoreValue(v) : null]));
}

const errorBody = (body: unknown): { message: string; status: string; reasons: string[] } => {
  const error = isObject(body) && isObject(body.error) ? body.error : {};
  const details = Array.isArray(error.details) ? error.details : [];
  return {
    message: typeof error.message === 'string' ? error.message : '',
    status: typeof error.status === 'string' ? error.status : '',
    reasons: details.flatMap((d) => (isObject(d) && typeof d.reason === 'string' ? [d.reason] : [])),
  };
};

/** 서버가 캐시해 둔 키가 바뀌었거나 만료됐다는 응답인지. (비밀번호 오류와는 구별된다.) */
function isApiKeyError(body: unknown): boolean {
  const { message, status, reasons } = errorBody(body);
  if (reasons.some((r) => r.startsWith('API_KEY'))) return true;
  if (message.includes('API_KEY') || /api key/i.test(message)) return true;
  return status === 'INVALID_ARGUMENT' && /\bkey\b/i.test(message);
}

function authErrorMessage(body: unknown): string {
  const { message } = errorBody(body);
  if (message.includes('EMAIL_NOT_FOUND') || message.includes('INVALID_PASSWORD') || message.includes('INVALID_LOGIN_CREDENTIALS')) {
    return MSG_WRONG_CREDENTIALS;
  }
  return MSG_SIGN_IN_FAILED;
}

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
};

/** 'YYYY-MM-DD' 의 UTC 자정 ms. */
const utcMidnightMs = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCFullYear(y); // 0~99 년이 1900 년대로 바뀌지 않게
  return date.getTime();
};

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const utcYmd = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * 투두메이트 계정에 본인 자격증명으로 직접 로그인해 일정을 읽어오는 클라이언트.
 *
 * 투두메이트는 공식 API/OAuth 가 없어서, 투두메이트가 공개 웹 설정으로 노출하는 Firebase 설정값
 * (브라우저에서는 CORS 로 막혀 있어 우리 서버가 대신 읽어 준다)을 받고, 사용자가 입력한 투두메이트
 * 이메일/비밀번호로 Firebase Auth REST 에 **브라우저에서 직접** 로그인한 뒤, 그 토큰으로 본인 소유
 * Firestore 문서만 조회한다. 비밀번호·토큰·일정은 우리 서버를 거치지 않는다.
 * (구글/애플 로그인 계정은 Firebase 쪽에 비밀번호 자격증명이 없어 이 방식이 통하지 않는다 —
 * 투두메이트 앱에서 이메일/비밀번호를 먼저 연결해야 한다.)
 */
export class TodoMateClient {
  private readonly getConfig: (refresh: boolean) => Promise<TodoMateConfig>;
  private readonly fetchImpl: typeof fetch;

  private idToken: string | null = null;
  private uid: string | null = null;
  private projectId: string | null = null;

  constructor({ getConfig, fetch: fetchImpl }: { getConfig: (refresh: boolean) => Promise<TodoMateConfig>; fetch?: typeof fetch }) {
    this.getConfig = getConfig;
    this.fetchImpl = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  }

  get isSignedIn() {
    return this.idToken != null;
  }

  async signIn(email: string, password: string): Promise<void> {
    let config = await this.loadConfig(false);
    let attempt = await this.postSignIn(config.apiKey, email, password);
    if (!attempt.ok && isApiKeyError(attempt.body)) {
      // 투두메이트가 키를 바꿨을 수 있다. 서버 캐시를 한 번만 갱신해 다시 시도한다.
      config = await this.loadConfig(true);
      attempt = await this.postSignIn(config.apiKey, email, password);
    }
    if (!attempt.ok) throw new TodoMateError(authErrorMessage(attempt.body));

    const body = isObject(attempt.body) ? attempt.body : {};
    if (typeof body.idToken !== 'string' || typeof body.localId !== 'string') throw new TodoMateError(MSG_SIGN_IN_FAILED);
    this.idToken = body.idToken;
    this.uid = body.localId;
    this.projectId = config.projectId;
  }

  private async loadConfig(refresh: boolean): Promise<TodoMateConfig> {
    let config: unknown;
    try {
      config = await this.getConfig(refresh);
    } catch (e) {
      // 로그인 만료 같은 TodoBuddy 서버 오류는 그 메시지를 그대로 보여준다.
      if (e instanceof ApiError || e instanceof TodoMateError) throw e;
      throw new TodoMateError(MSG_UNREACHABLE);
    }
    if (!isObject(config) || typeof config.apiKey !== 'string' || !config.apiKey || typeof config.projectId !== 'string' || !config.projectId) {
      throw new TodoMateError(MSG_BAD_CONFIG);
    }
    return { apiKey: config.apiKey, projectId: config.projectId };
  }

  private async postSignIn(apiKey: string, email: string, password: string): Promise<{ ok: boolean; body: unknown }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${SIGN_IN_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
    } catch {
      throw new TodoMateError(MSG_UNREACHABLE);
    }
    return { ok: res.status === 200, body: await readJson(res) };
  }

  /** start ~ end ('YYYY-MM-DD', 양끝 포함) 사이에 날짜가 있는 할 일만 카테고리별로 묶어서 돌려준다. */
  async fetchSchedules(start: string, end: string): Promise<TodoMateCategory[]> {
    const uid = this.uid;
    if (uid == null) throw new TodoMateError(MSG_NOT_SIGNED_IN);

    const goalDocs = await this.runEqualityQuery('Goal', 'userID', uid);
    const goalsById = new Map(goalDocs.map((g) => [g._id as string, g]));

    const todoDocs = await this.runEqualityQuery('TodoItem', 'writerID', uid);

    const startMs = utcMidnightMs(start);
    const endMs = utcMidnightMs(end);

    // 처음 나온 순서를 유지한다. 키 '' 는 Goal 이 없는(또는 이미 지워진) 할 일.
    const grouped = new Map<string, Json[]>();
    for (const todo of todoDocs) {
      const dateMs = todo.date;
      if (typeof dateMs !== 'number' || !Number.isInteger(dateMs) || dateMs < startMs || dateMs > endMs) continue;
      const goalId = typeof todo.goalID === 'string' && goalsById.has(todo.goalID) ? todo.goalID : '';
      const list = grouped.get(goalId);
      if (list) list.push(todo);
      else grouped.set(goalId, [todo]);
    }

    return [...grouped].map(([goalId, todos]) => {
      const goal = goalId ? goalsById.get(goalId) : undefined;
      todos.sort((a, b) => (a.date as number) - (b.date as number));
      const color = goal?.color;
      const visibility = typeof goal?.visibility === 'string' ? goal.visibility : 'private';
      return {
        name: typeof goal?.title === 'string' ? goal.title : '(미분류)',
        androidColor: typeof color === 'number' && Number.isInteger(color) ? color : null,
        isPrivate: visibility === 'private',
        todos: todos.map((t) => ({
          title: typeof t.content === 'string' ? t.content.trim() : '',
          date: utcYmd(t.date as number),
          completed: t.completed === true,
        })),
      };
    });
  }

  private async runEqualityQuery(collectionId: string, field: string, value: string): Promise<Json[]> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${firestoreBase(this.projectId ?? '')}:runQuery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.idToken}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
          },
        }),
      });
    } catch {
      throw new TodoMateError(MSG_FETCH_FAILED);
    }
    if (res.status !== 200) throw new TodoMateError(MSG_FETCH_FAILED);

    const items = await readJson(res);
    if (!Array.isArray(items)) throw new TodoMateError(MSG_FETCH_FAILED);

    const docs: Json[] = [];
    for (const item of items) {
      // 결과가 없으면 document 없이 readTime 만 담긴 항목이 온다.
      const doc = isObject(item) && isObject(item.document) ? item.document : null;
      if (!doc || typeof doc.name !== 'string') continue;
      const fields = decodeFirestoreFields(isObject(doc.fields) ? doc.fields : {});
      fields._id = doc.name.split('/').pop();
      docs.push(fields);
    }
    return docs;
  }
}
