import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'studance.db');

mkdirSync(DATA_DIR, { recursive: true });

let db: DatabaseSync | null = null;

function initSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      direction TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      experience TEXT,
      photo_url TEXT,
      impulse_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS directions (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      color TEXT,
      show_schedule_link INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS class_slots (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      teacher_id TEXT,
      teacher_name TEXT,
      hall_name TEXT,
      impulse_id TEXT,
      group_id INTEGER,
      synced_at TEXT,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_class_slots_day ON class_slots(day_of_week);
    CREATE INDEX IF NOT EXISTS idx_class_slots_impulse ON class_slots(impulse_id);

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      synced_count INTEGER,
      created_at TEXT NOT NULL
    );
  `);
}

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema(db);
  }
  return db;
}
