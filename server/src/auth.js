import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { get, run } from './db.js';

const SECRET = process.env.TODOBUDDY_JWT_SECRET ?? 'todobuddy-dev-secret-change-me';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30일

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
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

/** Authorization: Bearer <token> 을 검증해 req.user 를 채운다. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const payload = verifyToken(header.replace(/^Bearer\s+/i, ''));
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
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
 * 데스크탑 loopback 방식으로 받은 authorization code 를 교환해 구글 프로필을 얻는다.
 * (PKCE 사용, client_secret 은 설정돼 있을 때만 함께 보낸다.)
 */
export async function exchangeGoogleCode({ code, codeVerifier, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: googleConfig.clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  if (googleConfig.clientSecret) body.set('client_secret', googleConfig.clientSecret);

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
