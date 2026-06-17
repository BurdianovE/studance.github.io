import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'studance.db'));

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('tables:', tables.map((t) => t.name).join(', '));

for (const table of ['teachers', 'directions', 'class_slots', 'sync_log']) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
    console.log(`${table}:`, row.c);
  } catch {
    console.log(`${table}: missing`);
  }
}
