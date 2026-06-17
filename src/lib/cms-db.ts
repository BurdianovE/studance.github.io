import type { ClassSlot, CmsData, DirectionCard, Teacher } from './cms';
import { getDb } from './db';

type TeacherRow = {
  id: string;
  name: string;
  role: string;
  experience: string | null;
  photo_url: string | null;
  impulse_id: number | null;
  sort_order: number;
};

type DirectionRow = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  color: string | null;
  show_schedule_link: number;
  sort_order: number;
};

type ClassRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  title: string;
  teacher_id: string | null;
  teacher_name: string | null;
  hall_name: string | null;
  impulse_id: string | null;
  group_id: number | null;
  synced_at: string | null;
};

function rowToTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    experience: row.experience ?? undefined,
    photoUrl: row.photo_url ?? undefined,
  };
}

function rowToDirection(row: DirectionRow): DirectionCard {
  return {
    id: row.id,
    category: row.category as DirectionCard['category'],
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    color: row.color ?? undefined,
    schedule: row.show_schedule_link === 1,
  };
}

function rowToClass(row: ClassRow): ClassSlot {
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    teacherId: row.teacher_id ?? '',
    teacherName: row.teacher_name ?? undefined,
    hallName: row.hall_name ?? undefined,
    impulseId: row.impulse_id ?? undefined,
    syncedAt: row.synced_at ?? undefined,
  };
}

export function readCmsFromDb(): CmsData {
  const db = getDb();

  const teachers = db
    .prepare(
      `SELECT id, name, role, experience, photo_url, impulse_id, sort_order
       FROM teachers ORDER BY sort_order ASC, name ASC`
    )
    .all() as TeacherRow[];

  const directions = db
    .prepare(
      `SELECT id, category, title, subtitle, description, color, show_schedule_link, sort_order
       FROM directions ORDER BY sort_order ASC, title ASC`
    )
    .all() as DirectionRow[];

  const classes = db
    .prepare(
      `SELECT id, day_of_week, start_time, end_time, title, teacher_id, teacher_name,
              hall_name, impulse_id, group_id, synced_at
       FROM class_slots
       ORDER BY day_of_week ASC, start_time ASC, title ASC`
    )
    .all() as ClassRow[];

  return {
    teachers: teachers.map(rowToTeacher),
    directions: directions.map(rowToDirection),
    classes: classes.map(rowToClass),
  };
}

export function writeCmsToDb(data: CmsData): void {
  const db = getDb();

  const replaceTeachers = db.prepare(`
    INSERT INTO teachers (id, name, role, experience, photo_url, impulse_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      experience = excluded.experience,
      photo_url = excluded.photo_url,
      impulse_id = COALESCE(excluded.impulse_id, teachers.impulse_id),
      sort_order = excluded.sort_order
  `);

  const replaceDirections = db.prepare(`
    INSERT INTO directions (id, category, title, subtitle, description, color, show_schedule_link, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category = excluded.category,
      title = excluded.title,
      subtitle = excluded.subtitle,
      description = excluded.description,
      color = excluded.color,
      show_schedule_link = excluded.show_schedule_link,
      sort_order = excluded.sort_order
  `);

  const deleteMissingTeachers = db.prepare(
    `DELETE FROM teachers WHERE id NOT IN (SELECT value FROM json_each(?))`
  );
  const deleteMissingDirections = db.prepare(
    `DELETE FROM directions WHERE id NOT IN (SELECT value FROM json_each(?))`
  );

  const teacherIds = data.teachers.map((t) => t.id);
  const directionIds = data.directions.map((d) => d.id);

  db.exec('BEGIN');
  try {
    data.teachers.forEach((teacher, index) => {
      replaceTeachers.run(
        teacher.id,
        teacher.name,
        teacher.role,
        teacher.experience ?? null,
        teacher.photoUrl ?? null,
        null,
        index
      );
    });

    data.directions.forEach((direction, index) => {
      replaceDirections.run(
        direction.id,
        direction.category,
        direction.title,
        direction.subtitle,
        direction.description,
        direction.color ?? null,
        direction.schedule ? 1 : 0,
        index
      );
    });

    if (teacherIds.length > 0) {
      deleteMissingTeachers.run(JSON.stringify(teacherIds));
    } else {
      db.prepare('DELETE FROM teachers').run();
    }

    if (directionIds.length > 0) {
      deleteMissingDirections.run(JSON.stringify(directionIds));
    } else {
      db.prepare('DELETE FROM directions').run();
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function replaceSyncedClasses(slots: ClassSlot[]): number {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO class_slots (
      id, day_of_week, start_time, end_time, title, teacher_id, teacher_name,
      hall_name, impulse_id, group_id, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM class_slots').run();
    for (const slot of slots) {
      insert.run(
        slot.id,
        slot.dayOfWeek,
        slot.startTime,
        slot.endTime,
        slot.title,
        slot.teacherId || null,
        slot.teacherName ?? null,
        slot.hallName ?? null,
        slot.impulseId ?? null,
        slot.groupId ?? null,
        now
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return slots.length;
}

export function getLastSyncInfo(): { createdAt: string; syncedCount: number | null; status: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT created_at, synced_count, status
       FROM sync_log WHERE source = 'impulsecrm'
       ORDER BY id DESC LIMIT 1`
    )
    .get() as { created_at: string; synced_count: number | null; status: string } | undefined;

  if (!row) return null;
  return {
    createdAt: row.created_at,
    syncedCount: row.synced_count,
    status: row.status,
  };
}

export function logSync(source: string, status: string, message: string | null, syncedCount: number | null): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sync_log (source, status, message, synced_count, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(source, status, message, syncedCount, new Date().toISOString());
}

export function linkTeacherImpulseId(localId: string, impulseId: number): void {
  const db = getDb();
  db.prepare('UPDATE teachers SET impulse_id = ? WHERE id = ?').run(impulseId, localId);
}

export function findTeacherByImpulseId(impulseId: number): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM teachers WHERE impulse_id = ? LIMIT 1')
    .get(impulseId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function findTeacherByName(name: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM teachers WHERE lower(name) = lower(?) LIMIT 1')
    .get(name.trim()) as { id: string } | undefined;
  return row?.id ?? null;
}

export function isCmsEmpty(): boolean {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM teachers').get() as { c: number };
  return count.c === 0;
}

export function seedCmsData(data: CmsData): void {
  writeCmsToDb(data);
  if (data.classes.length > 0) {
    replaceSyncedClasses(data.classes);
  }
}
