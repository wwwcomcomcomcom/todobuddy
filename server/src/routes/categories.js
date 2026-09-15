import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { all, get, run, tx } from '../db.js';
import { isCrewMember, areFriends } from '../visibility.js';

const router = Router();
router.use(requireAuth);

const VISIBILITIES = new Set(['private', 'shared', 'public']);

export function serializeCategory(row, { includeShares = false } = {}) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    visibility: row.visibility,
    sortOrder: row.sort_order,
    owner: {
      id: row.owner_user_id ?? row.owner_id,
      name: row.owner_name ?? null,
      avatarUrl: row.owner_avatar ?? null,
    },
    shares: includeShares
      ? all('SELECT target_type, target_id FROM category_shares WHERE category_id = ?', row.id)
          .map((s) => ({ targetType: s.target_type, targetId: s.target_id }))
      : undefined,
  };
}

/** 공유 대상이 실제로 내 크루/내 친구인지 확인한 뒤 통째로 다시 쓴다. */
function replaceShares(categoryId, viewerId, shares) {
  run('DELETE FROM category_shares WHERE category_id = ?', categoryId);
  for (const { targetType, targetId } of shares ?? []) {
    const id = Number(targetId);
    const ok = targetType === 'crew' ? isCrewMember(id, viewerId)
      : targetType === 'friend' ? areFriends(viewerId, id) && id !== viewerId
      : false;
    if (!ok) continue;
    run('INSERT OR IGNORE INTO category_shares (category_id, target_type, target_id) VALUES (?, ?, ?)',
      categoryId, targetType, id);
  }
}

function ownedCategory(req, res) {
  const row = get('SELECT * FROM categories WHERE id = ?', Number(req.params.id));
  if (!row) { res.status(404).json({ error: 'not_found' }); return null; }
  if (row.owner_id !== req.user.id) { res.status(403).json({ error: 'forbidden' }); return null; }
  return row;
}

router.get('/', (req, res) => {
  const rows = all(
    `SELECT c.*, u.id AS owner_user_id, u.name AS owner_name, u.avatar_url AS owner_avatar
     FROM categories c JOIN users u ON u.id = c.owner_id
     WHERE c.owner_id = ? ORDER BY c.sort_order, c.id`,
    req.user.id,
  );
  res.json(rows.map((r) => serializeCategory(r, { includeShares: true })));
});

router.post('/', (req, res) => {
  const { name, color = '#111111', visibility = 'private', shares = [] } = req.body ?? {};
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'name required' });
  if (!VISIBILITIES.has(visibility)) return res.status(400).json({ error: 'invalid visibility' });

  const created = tx(() => {
    const next = get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM categories WHERE owner_id = ?', req.user.id).n;
    const info = run(
      'INSERT INTO categories (owner_id, name, color, visibility, sort_order) VALUES (?, ?, ?, ?, ?)',
      req.user.id, String(name).trim(), color, visibility, next,
    );
    const id = Number(info.lastInsertRowid);
    if (visibility === 'shared') replaceShares(id, req.user.id, shares);
    return get('SELECT * FROM categories WHERE id = ?', id);
  });
  res.status(201).json(serializeCategory(created, { includeShares: true }));
});

router.patch('/:id', (req, res) => {
  const row = ownedCategory(req, res);
  if (!row) return;
  const { name, color, visibility, shares } = req.body ?? {};
  if (visibility && !VISIBILITIES.has(visibility)) return res.status(400).json({ error: 'invalid visibility' });

  const updated = tx(() => {
    run('UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color), visibility = COALESCE(?, visibility) WHERE id = ?',
      name ?? null, color ?? null, visibility ?? null, row.id);
    const nextVisibility = visibility ?? row.visibility;
    if (nextVisibility !== 'shared') run('DELETE FROM category_shares WHERE category_id = ?', row.id);
    else if (shares) replaceShares(row.id, req.user.id, shares);
    return get('SELECT * FROM categories WHERE id = ?', row.id);
  });
  res.json(serializeCategory(updated, { includeShares: true }));
});

router.delete('/:id', (req, res) => {
  const row = ownedCategory(req, res);
  if (!row) return;
  run('DELETE FROM categories WHERE id = ?', row.id);
  res.status(204).end();
});

/** 카테고리 관리 화면의 드래그 정렬. 본인 소유 id 만 반영한다. */
router.post('/reorder', (req, res) => {
  const ids = (req.body?.ids ?? []).map(Number);
  tx(() => {
    ids.forEach((id, index) => {
      run('UPDATE categories SET sort_order = ? WHERE id = ? AND owner_id = ?', index, id, req.user.id);
    });
  });
  res.status(204).end();
});

export default router;
