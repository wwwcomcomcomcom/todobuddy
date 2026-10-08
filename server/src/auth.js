import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { get, run } from './db.js';

const SECRET = process.env.TODOBUDDY_JWT_SECRET ?? 'todobuddy-dev-secret-change-me';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30일

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, ttlSeconds = TTL_SECONDS) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64url(JSON.stringify(body))}`;
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ----- 웹(PWA) 세션 쿠키 -----
// 데스크탑 앱은 Bearer 토큰을, PWA 는 같은 출처의 httpOnly 쿠키를 쓴다. 둘 다 같은 JWT 다.

export const SESSION_COOKIE = 'tb_session';
const SECURE_COOKIES = process.env.TODOBUDDY_COOKIE_SECURE !== 'false';

/** PWA 가 떠 있는 출처들. 비어 있으면 요청의 Host 와 같은 출처만 허용한다. */
export const webOrigins = String(process.env.TODOBUDDY_WEB_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key || key in out) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // 깨진 쿠키는 없는 것으로 친다.
    }
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
  if (SECURE_COOKIES) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  res.append('Set-Cookie', parts.join('; '));
}

export const clearCookie = (res, name) => setCookie(res, name, '', { maxAge: 0 });

export function setSessionCookie(res, user) {
  setCookie(res, SESSION_COOKIE, signToken({ uid: user.id }), { maxAge: TTL_SECONDS });
}

/** 상태를 바꾸는 요청의 Origin 이 PWA 출처인지. 쿠키 인증의 CSRF 방어선이다. */
export function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin || origin === 'null') return false;
  if (webOrigins.length > 0) return webOrigins.includes(origin);
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 브라우저가 보낸 쓰기 요청 중 다른 출처에서 온 것은 인증 방식과 관계없이 막는다.
 * 데스크탑 앱은 Origin 을 보내지 않으므로 영향이 없다.
 */
export function rejectForeignOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method) || req.headers.origin == null) return next();
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden_origin' });
  next();
}

const hasBody = (req) =>
  req.headers['transfer-encoding'] != null || Number(req.headers['content-length'] ?? 0) > 0;

/**
 * Authorization: Bearer <token> 또는 세션 쿠키를 검증해 req.user 를 채운다.
 * 쿠키로 인증된 쓰기 요청은 PWA 출처에서 온 JSON 본문이어야 한다.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  let payload = null;
  if (/^Bearer\s+/i.test(header)) {
    payload = verifyToken(header.replace(/^Bearer\s+/i, ''));
    req.authVia = 'bearer';
  } else {
    const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (cookie) {
      payload = verifyToken(cookie);
      req.authVia = 'cookie';
    }
  }
  if (!payload || payload.purpose) return res.status(401).json({ error: 'unauthorized' });

  if (req.authVia === 'cookie' && !SAFE_METHODS.has(req.method)) {
    if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'forbidden_origin' });
    if (hasBody(req) && !req.is('application/json')) return res.status(415).json({ error: 'json_required' });
  }

  const user = get('SELECT * FROM users WHERE id = ?', payload.uid);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

/** 이름에서 중복되지 않는 핸들(@아이디)을 만든다. */
function uniqueHandle(base) {
  const slug = (base || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '')
    .slice(0, 12) || 'user';
  let candidate = slug;
  while (get('SELECT 1 FROM users WHERE handle = ?', candidate)) {
    candidate = `${slug}${randomBytes(2).toString('hex')}`;
  }
  return candidate;
}

/** google_sub 또는 email 로 기존 사용자를 찾고, 없으면 새로 만든다. */
export function upsertUser({ googleSub, email, name, avatarUrl }) {
  const existing =
    (googleSub && get('SELECT * FROM users WHERE google_sub = ?', googleSub)) ||
    (email && get('SELECT * FROM users WHERE email = ?', email));

  if (existing) {
    run(
      `UPDATE users SET google_sub = COALESCE(?, google_sub), avatar_url = COALESCE(avatar_url, ?)
       WHERE id = ?`,
      googleSub ?? null,
      avatarUrl ?? null,
      existing.id,
    );
    return get('SELECT * FROM users WHERE id = ?', existing.id);
  }

  const info = run(
    `INSERT INTO users (google_sub, email, name, avatar_url, handle) VALUES (?, ?, ?, ?, ?)`,
    googleSub ?? null,
    email ?? null,
    name || '이름 없음',
    avatarUrl ?? null,
    uniqueHandle(name ?? email?.split('@')[0]),
  );
  return get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
}

/** 개발용 로그인에서 이름 하나로 같은 계정을 재사용하기 위한 고정 이메일 규칙. */
export const devEmail = (name) => `${encodeURIComponent(String(name).trim())}@dev.local`;

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  get enabled() {
    return Boolean(this.clientId);
  },
};

/**
 * PWA 용 "웹 애플리케이션" 유형 OAuth 클라이언트. 서버가 리다이렉트를 주도한다.
 * 구글이 돌려보낼 주소는 PWA 출처의 `/api/auth/google/callback` 이다 (프록시가 `/api` 를 뗀다).
 */
export const googleWebConfig = {
  clientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
  clientSecret: process.env.GOOGLE_WEB_CLIENT_SECRET ?? '',
  /** 로그인을 마치고 돌아갈 PWA 주소 */
  appOrigin: webOrigins[0] ?? '',
  get redirectUri() {
    return process.env.GOOGLE_WEB_REDIRECT_URI || `${this.appOrigin}/api/auth/google/callback`;
  },
  get enabled() {
    return Boolean(this.clientId && this.clientSecret && this.appOrigin);
  },
};

/** PKCE: code_verifier 와 그 S256 challenge. */
export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * 구글이 돌려준 authorization code 를 교환해 구글 프로필을 얻는다.
 * 데스크탑 loopback 과 웹 리다이렉트가 같이 쓴다. (PKCE 사용, client_secret 은 설정돼 있을 때만 함께 보낸다.)
 */
export async function exchangeGoogleCode({ code, codeVerifier, redirectUri }, client = googleConfig) {
  const body = new URLSearchParams({
    code,
    client_id: client.clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  if (client.clientSecret) body.set('client_secret', client.clientSecret);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${await res.text()}`);

  const { id_token: idToken } = await res.json();
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
  return {
    googleSub: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.email,
    avatarUrl: claims.picture,
  };
}
