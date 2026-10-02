import { it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

it('기존 DB를 반복 실행해 업그레이드해도 기존 TODO는 보존된다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'todobuddy-migration-'));
  const path = join(dir, 'old.db');
  try {
    const db = new DatabaseSync(path);
    db.exec(`CREATE TABLE todos (id INTEGER PRIMARY KEY, category_id INTEGER, date TEXT, title TEXT, done INTEGER, sort_order INTEGER, created_at TEXT);
      INSERT INTO todos VALUES (1, NULL, '2026-10-01', '기존 할 일', 1, 0, '2026-10-01');`);
    db.close();
    for (let i = 0; i < 2; i++) {
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { db } from ${JSON.stringify(new URL('../src/db.js', import.meta.url).href)}; db.close();`], { env: { ...process.env, TODOBUDDY_DB: path }, encoding: 'utf8' });
      assert.equal(child.status, 0, child.stderr);
    }
    const migrated = new DatabaseSync(path);
    const row = migrated.prepare('SELECT * FROM todos').get();
    assert.equal(row.title, '기존 할 일');
    assert.equal(row.done, 1);
    assert.equal(row.routine_id, null);
    assert.equal(row.routine_override, 0);
    assert.equal(migrated.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'idx_todos_routine_date'").get().n, 1);
    migrated.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
