import { all, get, run, tx } from './db.js';
import { occurrences, shiftDate, MIN_DATE, MAX_DATE, todayInZone } from './recurrence.js';

export function serializeRoutine(row) {
  const version = get('SELECT * FROM routine_versions WHERE routine_id = ? ORDER BY id DESC LIMIT 1', row.id);
  return {
    id: row.id, categoryId: row.category_id, timeZone: row.time_zone,
    versionId: version.id, title: version.title, rule: JSON.parse(version.rule_json),
    startDate: version.start_date, endDate: version.end_date,
  };
}

export function addVersion(id, title, spec, validFrom) {
  run(`INSERT INTO routine_versions (routine_id, title, rule_json, start_date, end_date, valid_from)
       VALUES (?, ?, ?, ?, ?, ?)`, id, title, JSON.stringify(spec.rule), spec.startDate, spec.endDate, validFrom);
}

function* scheduled(row, from, to) {
  const versions = all('SELECT * FROM routine_versions WHERE routine_id = ? ORDER BY id', row.id);
  for (const version of versions) {
    const lower = [from, version.valid_from].sort().at(-1);
    const upper = [to, version.valid_until ?? MAX_DATE].sort()[0];
    const spec = { startDate: version.start_date, endDate: version.end_date, rule: JSON.parse(version.rule_json) };
    for (const date of occurrences(spec, lower, upper)) yield { date, title: version.title };
  }
}

/** Materialize only the visible range, including authorized friend/crew reads. */
export function ensureOccurrences(categoryIds, from, to) {
  if (!categoryIds.length) return;
  const rows = all(`SELECT * FROM routines WHERE category_id IN (${categoryIds.map(() => '?').join(',')})`, ...categoryIds);
  tx(() => {
    for (const row of rows) {
      let upper = to;
      if (row.deleted_on) {
        upper = [to, row.keep_today ? row.deleted_on : shiftDate(row.deleted_on, -1)].sort()[0];
        if (!row.keep_past_undone && !(row.keep_today && from <= row.deleted_on && to >= row.deleted_on)) continue;
      }
      if (from > upper) continue;
      const excluded = new Set(all('SELECT date FROM routine_exceptions WHERE routine_id = ? AND date BETWEEN ? AND ?', row.id, from, upper).map((r) => r.date));
      const existing = new Set(all('SELECT date FROM todos WHERE routine_id = ? AND date BETWEEN ? AND ?', row.id, from, upper).map((r) => r.date));
      for (const { date, title } of scheduled(row, from, upper)) {
        if (existing.has(date) || excluded.has(date)) continue;
        if (row.deleted_on && date < row.deleted_on && !row.keep_past_undone) continue;
        const order = get('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM todos WHERE category_id = ? AND date = ?', row.category_id, date).n;
        run('INSERT OR IGNORE INTO todos (category_id, date, title, sort_order, routine_id) VALUES (?, ?, ?, ?, ?)', row.category_id, date, title, order, row.id);
      }
    }
  });
}

/** Counts include unvisited dates, not just cached TODO rows. */
export function deletionPreview(row) {
  const today = todayInZone(row.time_zone);
  const todos = all('SELECT date, done FROM todos WHERE routine_id = ?', row.id);
  const existing = new Set(todos.map((t) => t.date));
  const excluded = new Set(all('SELECT date FROM routine_exceptions WHERE routine_id = ?', row.id).map((t) => t.date));
  let pastDone = 0, pastUndone = 0, todayCount = 0, futureCount = 0;
  for (const t of todos) {
    if (t.date < today) t.done ? pastDone++ : pastUndone++;
    else if (t.date === today) todayCount++;
    else futureCount++;
  }
  for (const { date } of scheduled(row, MIN_DATE, today)) {
    if (existing.has(date) || excluded.has(date)) continue;
    if (date === today) todayCount++;
    else pastUndone++;
  }
  return { today, timeZone: row.time_zone, pastDone, pastUndone, todayCount, futureCount };
}
