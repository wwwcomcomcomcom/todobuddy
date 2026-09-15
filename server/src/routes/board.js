import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { all } from '../db.js';
import { resolveScope } from '../visibility.js';
import { serializeCategory } from './categories.js';

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toLocaleDateString('sv-SE'); // sv-SE 는 YYYY-MM-DD 포맷

const serializeTodo = (t) => ({
  id: t.id,
  categoryId: t.category_id,
  date: t.date,
  title: t.title,
  done: Boolean(t.done),
  sortOrder: t.sort_order,
});

/** 메인 화면 한 번에 그리기: 프로필 + 보이는 카테고리 + 그 날짜의 TODO. */
router.get('/', (req, res) => {
  const date = DATE_RE.test(req.query.date ?? '') ? req.query.date : today();
  const scope = resolveScope(req.user, req.query.scope ?? 'me');
  if (!scope) return res.status(403).json({ error: 'forbidden' });

  const categories = scope.categories.map((row) => {
    const todos = all(
      'SELECT * FROM todos WHERE category_id = ? AND date = ? ORDER BY sort_order, id',
      row.id, date,
    );
    return {
      ...serializeCategory(row, { includeShares: row.owner_id === req.user.id }),
      editable: row.owner_id === req.user.id,
      todos: todos.map(serializeTodo),
    };
  });

  res.json({ date, profile: scope.profile, scopeKind: scope.kind, categories });
});

/**
 * 캘린더 색칠용 집계. 날짜마다 TODO 가 있는 카테고리별로
 * { color, total, done } 세그먼트를 돌려준다.
 */
router.get('/calendar', (req, res) => {
  const scope = resolveScope(req.user, req.query.scope ?? 'me');
  if (!scope) return res.status(403).json({ error: 'forbidden' });

  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-31`;

  const ids = scope.categories.map((c) => c.id);
  if (ids.length === 0) return res.json({ year, month, days: [] });

  const colorById = new Map(scope.categories.map((c) => [c.id, c.color]));
  const rows = all(
    `SELECT date, category_id, COUNT(*) AS total, SUM(done) AS done
     FROM todos
     WHERE date BETWEEN ? AND ? AND category_id IN (${ids.map(() => '?').join(',')})
     GROUP BY date, category_id ORDER BY date`,
    from, to, ...ids,
  );

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push({
      categoryId: r.category_id,
      color: colorById.get(r.category_id),
      total: r.total,
      done: Number(r.done ?? 0),
    });
  }

  res.json({
    year,
    month,
    days: [...byDate].map(([date, segments]) => ({ date, segments })),
  });
});

export default router;
