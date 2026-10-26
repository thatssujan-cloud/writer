import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.LETTERDESK_DB_PATH || path.join(process.cwd(), "data", "letterdesk.db");

let _db: Database.Database | null = null;

function migrate(db: Database.Database) {
  db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS academic_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,            -- JSON of validated profile fields
    cv_filename TEXT,              -- stored upload name (never served publicly)
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS researcher_cache (
    openalex_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,         -- normalized Researcher JSON
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_researchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    researcher_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, researcher_id)
  );

  CREATE TABLE IF NOT EXISTS saved_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, opportunity_id)
  );

  CREATE TABLE IF NOT EXISTS email_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    researcher_id TEXT,
    researcher_name TEXT,
    mode TEXT,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',   -- draft | reviewed | handed_off (user-confirmed only)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS outreach_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    researcher_id TEXT NOT NULL,
    researcher_name TEXT NOT NULL,
    institution TEXT,
    topic TEXT,
    contact_email TEXT,
    email_source TEXT,
    status TEXT NOT NULL DEFAULT 'saved',
    contacted_at TEXT,
    follow_up_date TEXT,
    last_response_at TEXT,
    next_action TEXT,
    notes TEXT,
    message_snapshot TEXT,
    related_application TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, researcher_id)          -- prevent duplicate records per researcher
  );

  CREATE TABLE IF NOT EXISTS roadmap_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT,
    linked_to TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'user',    -- template | user
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_researchers(user_id);
  CREATE INDEX IF NOT EXISTS idx_drafts_user ON email_drafts(user_id);
  CREATE INDEX IF NOT EXISTS idx_outreach_user ON outreach_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_user ON roadmap_tasks(user_id);
  `);
}

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  migrate(db);
  _db = db;
  return db;
}

// ---- typed helpers, all scoped by user_id for data isolation ----

export interface Row { [k: string]: unknown }

export function q<T = Row>(sql: string, params: Record<string, unknown> = {}): T[] {
  return getDb().prepare(sql).all(params) as T[];
}
export function q1<T = Row>(sql: string, params: Record<string, unknown> = {}): T | undefined {
  return getDb().prepare(sql).get(params) as T | undefined;
}
export function run(sql: string, params: Record<string, unknown> = {}) {
  return getDb().prepare(sql).run(params);
}
