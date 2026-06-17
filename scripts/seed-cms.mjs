import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'studance.db');
const CMS_JSON_PATH = path.join(DATA_DIR, 'cms.json');

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`
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
    synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    synced_count INTEGER,
    created_at TEXT NOT NULL
  );
`);

const existing = db.prepare('SELECT COUNT(*) AS c FROM teachers').get();
if (existing.c > 0) {
  console.log('CMS already seeded:', existing.c, 'teachers');
  process.exit(0);
}

const raw = await readFile(CMS_JSON_PATH, 'utf-8');
const cms = JSON.parse(raw);
const now = new Date().toISOString();

const insertTeacher = db.prepare(`
  INSERT INTO teachers (id, name, role, experience, photo_url, impulse_id, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertDirection = db.prepare(`
  INSERT INTO directions (id, category, title, subtitle, description, color, show_schedule_link, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertClass = db.prepare(`
  INSERT INTO class_slots (id, day_of_week, start_time, end_time, title, teacher_id, teacher_name, hall_name, impulse_id, group_id, synced_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
try {
  cms.teachers.forEach((t, i) => {
    insertTeacher.run(t.id, t.name, t.role ?? '', t.experience ?? null, t.photoUrl ?? null, null, i);
  });
  cms.directions.forEach((d, i) => {
    insertDirection.run(
      d.id,
      d.category,
      d.title,
      d.subtitle ?? '',
      d.description ?? '',
      d.color ?? null,
      d.schedule ? 1 : 0,
      i
    );
  });
  cms.classes.forEach((c) => {
    insertClass.run(
      c.id,
      c.dayOfWeek,
      c.startTime,
      c.endTime,
      c.title,
      c.teacherId ?? null,
      null,
      null,
      null,
      null,
      now
    );
  });
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
console.log('Seeded:', cms.teachers.length, 'teachers,', cms.directions.length, 'directions,', cms.classes.length, 'classes');
