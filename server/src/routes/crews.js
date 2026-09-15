import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireAuth } from '../auth.js';
import { all, get, run, tx } from '../db.js';
import { isCrewMember, toCrewProfile, toUserProfile } from '../visibility.js';

const router = Router();
router.use(requireAuth);

function newInviteCode() {
  let code;
  do {
    code = randomBytes(4).toString('hex').toUpperCase();
  } while (get('SELECT 1 FROM crews WHERE invite_code = ?', code));
  return code;
}

const withMemberCount = (crew) => ({
  ...toCrewProfile(crew),
  memberCount: get('SELECT COUNT(*) AS n FROM crew_members WHERE crew_id = ?', crew.id).n,
});

router.get('/', (req, res) => {
  const crews = all(
    `SELECT c.* FROM crews c JOIN crew_members m ON m.crew_id = c.id
     WHERE m.user_id = ? ORDER BY m.joined_at`,
    req.user.id,
  );
  res.json(crews.map(withMemberCount));
});

router.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });

  const crew = tx(() => {
    const info = run('INSERT INTO crews (name, bio, invite_code, owner_id) VALUES (?, ?, ?, ?)',
      name, String(req.body?.bio ?? ''), newInviteCode(), req.user.id);
    const id = Number(info.lastInsertRowid);
    run("INSERT INTO crew_members (crew_id, user_id, role) VALUES (?, ?, 'owner')", id, req.user.id);
    return get('SELECT * FROM crews WHERE id = ?', id);
  });
  res.status(201).json(withMemberCount(crew));
});

router.post('/join', (req, res) => {
  const code = String(req.body?.inviteCode ?? '').trim().toUpperCase();
  const crew = get('SELECT * FROM crews WHERE invite_code = ?', code);
  if (!crew) return res.status(404).json({ error: 'invalid_invite_code' });
  run('INSERT OR IGNORE INTO crew_members (crew_id, user_id) VALUES (?, ?)', crew.id, req.user.id);
  res.json(withMemberCount(crew));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!isCrewMember(id, req.user.id)) return res.status(403).json({ error: 'forbidden' });
  const crew = get('SELECT * FROM crews WHERE id = ?', id);
  const members = all(
    `SELECT u.* FROM users u JOIN crew_members m ON m.user_id = u.id
     WHERE m.crew_id = ? ORDER BY m.joined_at`, id,
  );
  res.json({ ...withMemberCount(crew), members: members.map(toUserProfile) });
});

router.patch('/:id', (req, res) => {
  const crew = get('SELECT * FROM crews WHERE id = ?', Number(req.params.id));
  if (!crew) return res.status(404).json({ error: 'not_found' });
  if (crew.owner_id !== req.user.id) return res.status(403).json({ error: 'owner_only' });
  const { name, bio, avatarUrl } = req.body ?? {};
  run('UPDATE crews SET name = COALESCE(?, name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url) WHERE id = ?',
    name ?? null, bio ?? null, avatarUrl ?? null, crew.id);
  res.json(withMemberCount(get('SELECT * FROM crews WHERE id = ?', crew.id)));
});

/** 크루 나가기. 방장은 혼자 남았을 때만 나갈 수 있고, 그 경우 크루가 삭제된다. */
router.post('/:id/leave', (req, res) => {
  const id = Number(req.params.id);
  const crew = get('SELECT * FROM crews WHERE id = ?', id);
  if (!crew || !isCrewMember(id, req.user.id)) return res.status(404).json({ error: 'not_found' });

  const memberCount = get('SELECT COUNT(*) AS n FROM crew_members WHERE crew_id = ?', id).n;
  if (crew.owner_id === req.user.id && memberCount > 1) {
    return res.status(409).json({ error: 'owner_must_transfer_or_empty_crew' });
  }
  tx(() => {
    run('DELETE FROM crew_members WHERE crew_id = ? AND user_id = ?', id, req.user.id);
    run("DELETE FROM category_shares WHERE target_type = 'crew' AND target_id = ? AND category_id IN (SELECT id FROM categories WHERE owner_id = ?)", id, req.user.id);
    if (crew.owner_id === req.user.id) run('DELETE FROM crews WHERE id = ?', id);
  });
  res.status(204).end();
});

export default router;
