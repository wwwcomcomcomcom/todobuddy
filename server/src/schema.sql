PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub   TEXT UNIQUE,
  email        TEXT UNIQUE,
  name         TEXT NOT NULL,
  bio          TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  handle       TEXT UNIQUE NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  bio          TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  invite_code  TEXT UNIQUE NOT NULL,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crew_members (
  crew_id      INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (crew_id, user_id)
);

-- status: 'pending' | 'accepted'
CREATE TABLE IF NOT EXISTS friendships (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at   TEXT,
  UNIQUE (requester_id, addressee_id)
);

-- visibility: 'private' (나만 보기) | 'shared' (지정한 크루/친구에게만) | 'public' (모든 친구·크루에게 자동 노출)
CREATE TABLE IF NOT EXISTS categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#111111',
  visibility   TEXT NOT NULL DEFAULT 'private',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_owner ON categories(owner_id, sort_order);

-- target_type: 'crew' | 'friend'
CREATE TABLE IF NOT EXISTS category_shares (
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL,
  target_id    INTEGER NOT NULL,
  PRIMARY KEY (category_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS todos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,              -- YYYY-MM-DD, TODO가 귀속되는 날짜
  title        TEXT NOT NULL,
  done         INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_todos_cat_date ON todos(category_id, date, sort_order);
