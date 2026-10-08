import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  SESSION_COOKIE, clearCookie, createPkcePair, devEmail, exchangeGoogleCode, googleConfig, googleWebConfig,
  parseCookies, requireAuth, setCookie, setSessionCookie, signToken, upsertUser, verifyToken,
} from '../auth.js';
import { run } from '../db.js';
import { toUserProfile } from '../visibility.js';

const router = Router();
// 이름만으로 계정을 만드는 통로라 기본은 꺼져 있다. 필요할 때만 명시적으로 켠다.
const allowDevLogin = process.env.TODOBUDDY_ALLOW_DEV_LOGIN === 'true';

const OAUTH_COOKIE = 'tb_oauth';
const OAUTH_TTL_SECONDS = 10 * 60;

/** 클라이언트가 어떤 로그인 수단을 띄울지 판단하기 위한 정보. */
router.get('/config', (_req, res) => {
  res.json({
    googleEnabled: googleConfig.enabled,
    googleClientId: googleConfig.clientId,
    googleWebEnabled: googleWebConfig.enabled,
    devLoginEnabled: allowDevLogin,
  });
});

router.post('/google', async (req, res) => {
  if (!googleConfig.enabled) return res.status(503).json({ error: 'google_oauth_not_configured' });
  const { code, codeVerifier, redirectUri } = req.body ?? {};
  if (!code || !codeVerifier || !redirectUri) {
    return res.status(400).json({ error: 'code, codeVerifier, redirectUri required' });
  }
  try {
    const profile = await exchangeGoogleCode({ code, codeVerifier, redirectUri });
    const user = upsertUser(profile);
    res.json({ token: signToken({ uid: user.id }), user: toUserProfile(user) });
  } catch (err) {
    res.status(401).json({ error: 'google_auth_failed', detail: String(err.message ?? err) });
  }
});

/**
 * PWA 의 구글 로그인 시작. state·code_verifier 를 짧게 사는 서명 쿠키에 담아 두고 구글로 보낸다.
 * 브라우저는 loopback 포트를 열 수 없으므로 서버가 리다이렉트를 주도한다.
 */
router.get('/google/start', (_req, res) => {
  if (!googleWebConfig.enabled) return res.status(503).json({ error: 'google_oauth_not_configured' });
  const state = randomBytes(16).toString('base64url');
  const { verifier, challenge } = createPkcePair();
  setCookie(res, OAUTH_COOKIE, signToken({ purpose: 'oauth', state, verifier }, OAUTH_TTL_SECONDS),
    { maxAge: OAUTH_TTL_SECONDS });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: googleWebConfig.clientId,
    redirect_uri: googleWebConfig.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  res.redirect(302, url.toString());
});

const sameString = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
};

/** 구글이 돌려보내는 곳. state 를 확인하고 세션 쿠키를 심은 뒤 PWA 로 돌려보낸다. */
router.get('/google/callback', async (req, res) => {
  if (!googleWebConfig.enabled) return res.status(503).json({ error: 'google_oauth_not_configured' });
  const back = (error) => res.redirect(302, `${googleWebConfig.appOrigin}/${error ? `login?error=${error}` : ''}`);

  const saved = verifyToken(parseCookies(req.headers.cookie)[OAUTH_COOKIE]);
  clearCookie(res, OAUTH_COOKIE);
  if (req.query.error) return back('google_cancelled');
  if (saved?.purpose !== 'oauth' || !sameString(saved.state, req.query.state) || !req.query.code) {
    return back('google_state_mismatch');
  }

  try {
    const profile = await exchangeGoogleCode(
      { code: String(req.query.code), codeVerifier: saved.verifier, redirectUri: googleWebConfig.redirectUri },
      googleWebConfig,
    );
    setSessionCookie(res, upsertUser(profile));
    back();
  } catch (err) {
    console.error(err);
    back('google_auth_failed');
  }
});

/** 구글 클라이언트 ID 없이 개발할 때 쓰는 로그인. 이름만으로 계정을 만들거나 재사용한다. */
router.post('/dev', (req, res) => {
  if (!allowDevLogin) return res.status(403).json({ error: 'dev_login_disabled' });
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = upsertUser({ email: devEmail(name), name });
  setSessionCookie(res, user);
  res.json({ token: signToken({ uid: user.id }), user: toUserProfile(user) });
});

/** PWA 로그아웃. 세션 쿠키를 지운다 (데스크탑 앱은 토큰을 스스로 버린다). */
router.post('/logout', (_req, res) => {
  clearCookie(res, SESSION_COOKIE);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  // 쿠키 세션은 쓰는 동안 계속 연장한다. 30일 동안 안 열면 만료된다.
  if (req.authVia === 'cookie') setSessionCookie(res, req.user);
  res.json(toUserProfile(req.user));
});

router.patch('/me', requireAuth, (req, res) => {
  const { name, bio, avatarUrl } = req.body ?? {};
  run(
    `UPDATE users SET name = COALESCE(?, name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url)
     WHERE id = ?`,
    name ?? null, bio ?? null, avatarUrl ?? null, req.user.id,
  );
  res.json(toUserProfile({ ...req.user, name: name ?? req.user.name, bio: bio ?? req.user.bio, avatar_url: avatarUrl ?? req.user.avatar_url }));
});

export default router;
