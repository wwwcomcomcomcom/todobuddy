import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { all, get, run, tx } from '../db.js';
import { normalizeSchedule, occurrences, todayInZone, shiftDate } from '../recurrence.js';
import { serializeRoutine, addVersion, deletionPreview } from '../routines.js';

const router = Router();
router.use(requireAuth);

function myRoutine(req, res) {
  const row = get(`SELECT r.* FROM routines r JOIN categories c ON c.id = r.category_id
    WHERE r.id = ? AND c.owner_id = ? AND r.deleted_on IS NULL`, Number(req.params.id), req.user.id);
  if (!row) res.status(404).json({ error: 'not_found' });
  return row;
}

function specFrom(req, res) {
  try { return normalizeSchedule(req.body); }
  catch (err) { res.status(400).json({ error: 'invalid_routine', detail: err.message }); }
}

function titleFrom(req, res) {
  const title = req.body?.title;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 500) {
    res.status(400).json({ error: 'invalid_routine', detail: '할 일 이름을 1~500자로 입력해 주세요.' });
    return null;
  }
  return title.trim();
}

router.get('/', (req, res) => {
  const rows = all(`SELECT r.* FROM routines r JOIN categories c ON c.id = r.category_id
    WHERE c.owner_id = ? AND r.deleted_on IS NULL ORDER BY r.id DESC`, req.user.id);
  res.json(rows.map(serializeRoutine));
});

router.post('/preview', (req, res) => {
  const spec = specFrom(req, res);
  if (!spec) return;
  const today = todayInZone(spec.timeZone);
  const dates = [];
  for (const date of occurrences(spec, today)) {
    dates.push(date);
    if (dates.length === 5) break;
  }
  res.json({ dates, today, timeZone: spec.timeZone });
});

router.post('/', (req, res) => {
  const spec = specFrom(req, res);
  if (!spec) return;
  const title = titleFrom(req, res);
  if (!title) return;
  const category = get('SELECT id FROM categories WHERE id = ? AND owner_id = ?', Number(req.body.categoryId), req.user.id);
  if (!category) return res.status(403).json({ error: 'forbidden' });
  const created = tx(() => {
    const { lastInsertRowid: id } = run('INSERT INTO routines (category_id, time_zone) VALUES (?, ?)', category.id, spec.timeZone);
    addVersion(id, title, spec, spec.startDate);
    return serializeRoutine(get('SELECT * FROM routines WHERE id = ?', id));
  });
  res.status(201).json(created);
});

router.patch('/:id', (req, res) => {
  const row = myRoutine(req, res);
  if (!row) return;
  const spec = specFrom(req, res);
  if (!spec) return;
  const title = titleFrom(req, res);
  if (!title) return;
  if (spec.timeZone !== row.time_zone || Number(req.body.categoryId) !== row.category_id) {
    return res.status(400).json({ error: 'invalid_routine', detail: '기록 보존을 위해 카테고리와 시간대는 변경할 수 없어요.' });
  }
  const latest = serializeRoutine(row);
  if (req.body.versionId !== latest.versionId) return res.status(409).json({ error: 'routine_changed' });
  const today = todayInZone(row.time_zone);
  tx(() => {
    // Keep historical rules without having to materialize every past date.
    run('DELETE FROM routine_versions WHERE routine_id = ? AND valid_from >= ?', row.id, today);
    run('UPDATE routine_versions SET valid_until = ? WHERE routine_id = ? AND (valid_until IS NULL OR valid_until >= ?)', shiftDate(today, -1), row.id, today);
    addVersion(row.id, title, spec, today);
    // Completed and individually edited occurrences are user records.
    run('DELETE FROM todos WHERE routine_id = ? AND date >= ? AND done = 0 AND routine_override = 0', row.id, today);
  });
  res.json(serializeRoutine(row));
});

router.get('/:id/deletion-preview', (req, res) => {
  const row = myRoutine(req, res);
  if (row) res.json(deletionPreview(row));
});

router.delete('/:id', (req, res) => {
  const row = myRoutine(req, res);
  if (!row) return;
  const { keepPastDone, keepPastUndone, removeToday, asOfDate } = req.body ?? {};
  if ([keepPastDone, keepPastUndone, removeToday].some((v) => typeof v !== 'boolean')) {
    return res.status(400).json({ error: 'invalid_routine', detail: '기록 보존 옵션을 선택해 주세요.' });
  }
  const today = todayInZone(row.time_zone);
  if (asOfDate !== today) return res.status(409).json({ error: 'routine_date_changed' });
  tx(() => {
    run('UPDATE routines SET deleted_on = ?, keep_past_undone = ?, keep_today = ? WHERE id = ?', today, Number(keepPastUndone), Number(!removeToday), row.id);
    // A removed completed occurrence must not return as an uncompleted one.
    run(`INSERT OR IGNORE INTO routine_exceptions (routine_id, date)
      SELECT routine_id, date FROM todos WHERE routine_id = ? AND date < ? AND done = 1 AND ? = 0`,
    row.id, today, Number(keepPastDone));
    run(`DELETE FROM todos WHERE routine_id = ? AND (
      date > ? OR (date = ? AND ? = 1) OR
      (date < ? AND ((done = 1 AND ? = 0) OR (done = 0 AND ? = 0))))`,
    row.id, today, today, Number(removeToday), today, Number(keepPastDone), Number(keepPastUndone));
  });
  res.status(204).end();
});

export default router;
