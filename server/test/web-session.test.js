import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// PWA 용 쿠키 세션·CSRF·구글 웹 로그인. 데스크탑(Bearer) 쪽은 api.test.js 가 맡는다.
const workDir = mkdtempSync(join(tmpdir(), 'todobuddy-web-'));
const PORT = 4112;
const base = `http://127.0.0.1:${PORT}`;
const APP = 'https://app.todobuddy.test';
let server;

async function waitForReady(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // 아직 뜨는 중
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function call(path, { method = 'GET', cookie, origin, body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json, headers: res.headers, cookies: res.headers.getSetCookie() };
}

/** Set-Cookie 목록에서 이름=값 만 뽑아 다음 요청의 Cookie 헤더로 쓴다. */
const cookieFrom = (setCookies, name) => {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  return line ? line.split(';')[0] : null;
};

async function devLogin(name) {
  const res = await call('/auth/dev', { method: 'POST', origin: APP, body: { name } });
  assert.equal(res.status, 200);
  return { ...res.body, cookie: cookieFrom(res.cookies, 'tb_session'), setCookie: res.cookies };
}

before(async () => {
  server = spawn(process.execPath, [new URL('../src/index.js', import.meta.url).pathname], {
    env: {
      ...process.env,
      PORT: String(PORT),
      TODOBUDDY_DB: join(workDir, 'test.db'),
      TODOBUDDY_UPLOAD_DIR: join(workDir, 'uploads'),
      TODOBUDDY_LOG: 'off',
      TODOBUDDY_ALLOW_DEV_LOGIN: 'true',
      TODOBUDDY_WEB_ORIGIN: APP,
      GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
      GOOGLE_WEB_CLIENT_SECRET: 'web-secret',
      GOOGLE_CLIENT_ID: '',
    },
    stdio: 'ignore',
  });
  await waitForReady();
});

after(() => {
  server?.kill();
  rmSync(workDir, { recursive: true, force: true });
});

describe('쿠키 세션', () => {
  it('개발용 로그인은 토큰과 함께 httpOnly 세션 쿠키를 심는다', async () => {
    const me = await devLogin('쿠키');
    assert.ok(me.token);
    const line = me.setCookie.find((c) => c.startsWith('tb_session='));
    assert.match(line, /HttpOnly/);
    assert.match(line, /Secure/);
    assert.match(line, /SameSite=Lax/);
    assert.match(line, /Path=\//);
    assert.match(line, /Max-Age=2592000/);
  });

  it('쿠키만으로 읽기 요청이 인증되고, /auth/me 는 쿠키를 연장한다', async () => {
    const me = await devLogin('읽기');
    const res = await call('/auth/me', { cookie: me.cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, '읽기');
    assert.ok(cookieFrom(res.cookies, 'tb_session'));

    const board = await call('/board?scope=me', { cookie: me.cookie });
    assert.equal(board.status, 200);
  });

  it('쿠키가 없거나 깨졌으면 401', async () => {
    assert.equal((await call('/auth/me')).status, 401);
    assert.equal((await call('/auth/me', { cookie: 'tb_session=garbage' })).status, 401);
  });

  it('쿠키로 인증된 쓰기는 PWA 출처에서 온 JSON 이어야 한다', async () => {
    const me = await devLogin('쓰기');
    const body = { name: '운동', visibility: 'private' };

    const ok = await call('/categories', { method: 'POST', cookie: me.cookie, origin: APP, body });
    assert.equal(ok.status, 201);

    // Origin 이 없으면 쿠키 요청은 거부한다 (Bearer 가 아닌 이상 브라우저에서 온 것이다).
    const noOrigin = await call('/categories', { method: 'POST', cookie: me.cookie, body });
    assert.equal(noOrigin.status, 403);

    const foreign = await call('/categories', { method: 'POST', cookie: me.cookie, origin: 'https://evil.test', body });
    assert.equal(foreign.status, 403);
    assert.equal(foreign.body.error, 'forbidden_origin');

    // 폼 전송처럼 보이는 본문은 출처가 맞아도 받지 않는다.
    const form = await call('/categories', {
      method: 'POST', cookie: me.cookie, origin: APP, body: 'name=x',
      headers: { 'content-type': 'text/plain' },
    });
    assert.equal(form.status, 415);

    // 본문 없는 쓰기(수락·나가기 등)는 Content-Type 없이도 된다.
    const crew = await call('/crews', { method: 'POST', cookie: me.cookie, origin: APP, body: { name: '조' } });
    const leave = await call(`/crews/${crew.body.id}/leave`, { method: 'POST', cookie: me.cookie, origin: APP });
    assert.equal(leave.status, 204);
  });

  it('다른 출처에서 온 쓰기는 Bearer 여도 막는다 (데스크탑 앱은 Origin 을 보내지 않는다)', async () => {
    const me = await devLogin('베어러');
    const res = await call('/categories', {
      method: 'POST', origin: 'https://evil.test', body: { name: 'x' },
      headers: { authorization: `Bearer ${me.token}` },
    });
    assert.equal(res.status, 403);

    const desktop = await call('/categories', {
      method: 'POST', body: { name: 'x' }, headers: { authorization: `Bearer ${me.token}` },
    });
    assert.equal(desktop.status, 201);
  });

  it('로그아웃은 세션 쿠키를 지운다', async () => {
    const res = await call('/auth/logout', { method: 'POST', origin: APP });
    assert.equal(res.status, 204);
    const line = res.cookies.find((c) => c.startsWith('tb_session='));
    assert.match(line, /^tb_session=;/);
    assert.match(line, /Max-Age=0/);

    assert.equal((await call('/auth/logout', { method: 'POST', origin: 'https://evil.test' })).status, 403);
  });
});

describe('구글 웹 로그인', () => {
  it('/auth/config 가 웹 로그인 가능 여부를 알려 준다', async () => {
    const res = await call('/auth/config');
    assert.equal(res.body.googleWebEnabled, true);
    assert.equal(res.body.googleEnabled, false);
  });

  it('start 는 PKCE·state 를 담아 구글로 보내고, state 를 서명 쿠키에 보관한다', async () => {
    const res = await call('/auth/google/start');
    assert.equal(res.status, 302);
    const url = new URL(res.headers.get('location'));
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    const q = url.searchParams;
    assert.equal(q.get('client_id'), 'web-client-id.apps.googleusercontent.com');
    assert.equal(q.get('redirect_uri'), `${APP}/api/auth/google/callback`);
    assert.equal(q.get('response_type'), 'code');
    assert.equal(q.get('code_challenge_method'), 'S256');
    assert.match(q.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
    assert.match(q.get('state'), /^[A-Za-z0-9_-]{22}$/);
    assert.match(q.get('scope'), /openid/);

    const line = res.cookies.find((c) => c.startsWith('tb_oauth='));
    assert.match(line, /HttpOnly/);
    assert.match(line, /Max-Age=600/);
  });

  it('start 쿠키는 세션으로 쓸 수 없다', async () => {
    const res = await call('/auth/google/start');
    const oauth = cookieFrom(res.cookies, 'tb_oauth').replace('tb_oauth=', 'tb_session=');
    assert.equal((await call('/auth/me', { cookie: oauth })).status, 401);
  });

  it('state 가 맞지 않으면 토큰 교환 없이 로그인 화면으로 돌려보낸다', async () => {
    const start = await call('/auth/google/start');
    const cookie = cookieFrom(start.cookies, 'tb_oauth');

    const wrong = await call('/auth/google/callback?code=abc&state=nope', { cookie });
    assert.equal(wrong.status, 302);
    assert.equal(wrong.headers.get('location'), `${APP}/login?error=google_state_mismatch`);
    assert.equal(cookieFrom(wrong.cookies, 'tb_session'), null);

    const missing = await call('/auth/google/callback?code=abc&state=nope');
    assert.equal(missing.headers.get('location'), `${APP}/login?error=google_state_mismatch`);

    const cancelled = await call('/auth/google/callback?error=access_denied', { cookie });
    assert.equal(cancelled.headers.get('location'), `${APP}/login?error=google_cancelled`);
  });
});

describe('투두메이트 설정 중계', () => {
  it('로그인하지 않으면 쓸 수 없다', async () => {
    assert.equal((await call('/todomate/config')).status, 401);
  });
});
