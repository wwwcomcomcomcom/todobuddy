import { Router } from 'express';
import { devEmail, exchangeGoogleCode, googleConfig, requireAuth, signToken, upsertUser } from '../auth.js';
import { run } from '../db.js';
import { toUserProfile } from '../visibility.js';

const router = Router();
// 이름만으로 계정을 만드는 통로라 기본은 꺼져 있다. 필요할 때만 명시적으로 켠다.
const allowDevLogin = process.env.TODOBUDDY_ALLOW_DEV_LOGIN === 'true';

/** 클라이언트가 어떤 로그인 수단을 띄울지 판단하기 위한 정보. */
router.get('/config', (_req, res) => {
  res.json({
    googleEnabled: googleConfig.enabled,
    googleClientId: googleConfig.clientId,
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

/** 구글 클라이언트 ID 없이 개발할 때 쓰는 로그인. 이름만으로 계정을 만들거나 재사용한다. */
router.post('/dev', (req, res) => {
  if (!allowDevLogin) return res.status(403).json({ error: 'dev_login_disabled' });
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const user = upsertUser({ email: devEmail(name), name });
  res.json({ token: signToken({ uid: user.id }), user: toUserProfile(user) });
});

router.get('/me', requireAuth, (req, res) => res.json(toUserProfile(req.user)));

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
