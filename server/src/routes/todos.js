import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { get, run, tx } from '../db.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const serialize = (t) => ({
  id: t.id,
  categoryId: t.category_id,
  date: t.date,
  title: t.title,
  done: Boolean(t.done),
  sortOrder: t.sort_order,
});

/** 쓰기는 항상 본인 카테고리에만 허용된다. 친구·크루 화면은 읽기 전용. */
function myTodo(req, res) {
  const row = get(
    `SELECT t.* FROM todos t JOIN categories c ON c.id = t.category_id
     WHERE t.id = ? AND c.owner_id = ?`,
    Number(req.params.id), req.user.id,
  );
  if (!row) { res.status(404).json({ error: 'not_found' }); return null; }
  return row;
}

router.post('/', (req, res) => {
  const { categoryId, date, title } = req.body ?? {};
  if (!String(title ?? '').trim()) return res.status(400).json({ error: 'title required' });
  if (!DATE_RE.test(date ?? '')) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const category = get('SELECT * FROM categories WHERE id = ? AND owner_id = ?', Number(categoryId), req.user.id);
  if (!category) return res.status(403).json({ error: 'forbidden' });

  const created = tx(() => {
    const next = get(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM todos WHERE category_id = ? AND date = ?',
      category.id, date,
    ).n;
    const info = run('INSERT INTO todos (category_id, date, title, sort_order) VALUES (?, ?, ?, ?)',
      category.id, date, String(title).trim(), next);
    return get('SELECT * FROM todos WHERE id = ?', info.lastInsertRowid);
  });
  res.status(201).json(serialize(created));
});

router.patch('/:id', (req, res) => {
  const row = myTodo(req, res);
  if (!row) return;
  const { title, done } = req.body ?? {};
  run('UPDATE todos SET title = COALESCE(?, title), done = COALESCE(?, done) WHERE id = ?',
    title == null ? null : String(title).trim(),
    done == null ? null : (done ? 1 : 0),
    row.id);
  res.json(serialize(get('SELECT * FROM todos WHERE id = ?', row.id)));
});

router.delete('/:id', (req, res) => {
  const row = myTodo(req, res);
  if (!row) return;
  run('DELETE FROM todos WHERE id = ?', row.id);
  res.status(204).end();
});

export default router;
