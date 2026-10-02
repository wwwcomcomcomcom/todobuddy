import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.TODOBUDDY_DB ?? join(__dirname, '..', 'data', 'todobuddy.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));

// Existing installations need additive migrations; CREATE TABLE does not add columns.
tx(() => {
  const columns = new Set(db.prepare('PRAGMA table_info(todos)').all().map((c) => c.name));
  if (!columns.has('routine_id')) {
    db.exec('ALTER TABLE todos ADD COLUMN routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE');
  }
  if (!columns.has('routine_override')) {
    db.exec('ALTER TABLE todos ADD COLUMN routine_override INTEGER NOT NULL DEFAULT 0');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_routine_date ON todos(routine_id, date) WHERE routine_id IS NOT NULL');
});

/** SELECT 여러 행 */
export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

/** SELECT 한 행 (없으면 undefined) */
export function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

/** INSERT/UPDATE/DELETE */
export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

/** 콜백을 하나의 트랜잭션으로 묶어 실행한다. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
