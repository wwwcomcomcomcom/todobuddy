import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { all, get, run, tx } from '../db.js';
import { toUserProfile } from '../visibility.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const me = req.user.id;
  const friends = all(
    `SELECT u.*, f.id AS friendship_id FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
     ORDER BY u.name`, me, me, me,
  );
  const incoming = all(
    `SELECT u.*, f.id AS friendship_id FROM friendships f JOIN users u ON u.id = f.requester_id
     WHERE f.status = 'pending' AND f.addressee_id = ? ORDER BY f.created_at DESC`, me,
  );
  const outgoing = all(
    `SELECT u.*, f.id AS friendship_id FROM friendships f JOIN users u ON u.id = f.addressee_id
     WHERE f.status = 'pending' AND f.requester_id = ? ORDER BY f.created_at DESC`, me,
  );
  const shape = (r) => ({ ...toUserProfile(r), friendshipId: r.friendship_id });
  res.json({ friends: friends.map(shape), incoming: incoming.map(shape), outgoing: outgoing.map(shape) });
});

/** 핸들 또는 이름으로 사용자 검색 (자기 자신 제외). */
router.get('/search', (req, res) => {
  const q = `%${String(req.query.q ?? '').trim()}%`;
  if (q === '%%') return res.json([]);
  const rows = all(
    'SELECT * FROM users WHERE id != ? AND (handle LIKE ? OR name LIKE ?) ORDER BY name LIMIT 20',
    req.user.id, q, q,
  );
  res.json(rows.map(toUserProfile));
});

/**
 * 친구 요청. 상대가 이미 나에게 요청해 둔 상태라면(양쪽 동시 요청)
 * 새 요청을 만드는 대신 바로 수락 처리한다.
 */
router.post('/request', (req, res) => {
  const me = req.user.id;
  const target = req.body?.userId
    ? get('SELECT * FROM users WHERE id = ?', Number(req.body.userId))
    : get('SELECT * FROM users WHERE handle = ?', String(req.body?.handle ?? '').trim());

  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === me) return res.status(400).json({ error: 'cannot_friend_self' });

  const reverse = get(
    "SELECT * FROM friendships WHERE requester_id = ? AND addressee_id = ?", target.id, me,
  );
  if (reverse) {
    if (reverse.status === 'pending') {
      run("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?", reverse.id);
    }
    return res.json({ status: 'accepted', friendshipId: reverse.id, user: toUserProfile(target) });
  }

  const existing = get('SELECT * FROM friendships WHERE requester_id = ? AND addressee_id = ?', me, target.id);
  if (existing) return res.json({ status: existing.status, friendshipId: existing.id, user: toUserProfile(target) });

  const info = run('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)', me, target.id);
  res.status(201).json({ status: 'pending', friendshipId: Number(info.lastInsertRowid), user: toUserProfile(target) });
});

router.post('/:id/accept', (req, res) => {
  const row = get('SELECT * FROM friendships WHERE id = ? AND addressee_id = ?', Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  run("UPDATE friendships SET status = 'accepted', accepted_at = datetime('now') WHERE id = ?", row.id);
  res.status(204).end();
});

/** 요청 취소 / 거절 / 친구 삭제를 모두 처리한다. 삭제 시 해당 친구 대상 공유도 함께 정리. */
router.delete('/:id', (req, res) => {
  const me = req.user.id;
  const row = get(
    'SELECT * FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)',
    Number(req.params.id), me, me,
  );
  if (!row) return res.status(404).json({ error: 'not_found' });
  const other = row.requester_id === me ? row.addressee_id : row.requester_id;

  tx(() => {
    run('DELETE FROM friendships WHERE id = ?', row.id);
    run(`DELETE FROM category_shares
         WHERE target_type = 'friend'
           AND ((target_id = ? AND category_id IN (SELECT id FROM categories WHERE owner_id = ?))
             OR (target_id = ? AND category_id IN (SELECT id FROM categories WHERE owner_id = ?)))`,
      other, me, me, other);
  });
  res.status(204).end();
});

export default router;
