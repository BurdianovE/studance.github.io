import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCmsEmpty, readCmsFromDb, seedCmsData, writeCmsToDb } from './cms-db';
import { getDb } from './db';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CMS_JSON_PATH = path.join(ROOT, 'data', 'cms.json');

export interface Teacher {
  id: string;
  name: string;
  role: string;
  experience?: string;
  photoUrl?: string;
}

export interface ClassSlot {
  id: string;
  /** 1 = Monday … 7 = Sunday */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  teacherId: string;
  teacherName?: string;
  hallName?: string;
  impulseId?: string;
  groupId?: number;
  syncedAt?: string;
}

export interface CmsData {
  teachers: Teacher[];
  classes: ClassSlot[];
  directions: DirectionCard[];
}

export type DirectionCategory = 'adults' | 'teens' | 'ensemble' | 'other';

export interface DirectionCard {
  id: string;
  category: DirectionCategory;
  title: string;
  subtitle: string;
  description: string;
  color?: string;
  schedule?: boolean;
}

const DEFAULT_CMS: CmsData = {
  teachers: [
    {
      id: 't1',
      name: 'Анна Петрова',
      role: 'Бачата, Сальса',
      experience: '8 лет',
    },
    {
      id: 't2',
      name: 'Михаил Сидоров',
      role: 'Хип-хоп, Брейк-данс',
      experience: '12 лет',
    },
    {
      id: 't3',
      name: 'Елена Козлова',
      role: 'Растяжка, Современный',
      experience: '6 лет',
    },
    {
      id: 't4',
      name: 'Дмитрий Иванов',
      role: 'Детские направления',
      experience: '10 лет',
    },
  ],
  classes: [],
  directions: [
    {
      id: 'd1',
      category: 'adults',
      title: 'Бачата парная',
      subtitle: 'Что вас ждёт на занятии?',
      description:
        'Это не просто урок танца — это полноценная кардио-тренировка в формате зажигательной вечеринки!',
      color: '#F5C800',
      schedule: true,
    },
    {
      id: 'd2',
      category: 'adults',
      title: 'Сальса',
      subtitle: 'Что вас ждёт на занятии?',
      description: 'Зажигательные ритмы Карибского моря, яркая энергия и настоящий кайф от движения.',
      color: '#FF6B6B',
      schedule: true,
    },
    {
      id: 'd3',
      category: 'teens',
      title: 'Хип-хоп',
      subtitle: 'Что вас ждёт на занятии?',
      description: 'Уличная культура, фристайл и крутые движения.',
      color: '#2A5060',
      schedule: true,
    },
  ],
};

let migrated = false;

function ensureMigrated(): void {
  if (migrated) return;
  getDb();
  migrated = true;
}

export function normalize(data: unknown): CmsData {
  if (!data || typeof data !== 'object') return structuredClone(DEFAULT_CMS);
  const d = data as Record<string, unknown>;
  const teachers = Array.isArray(d.teachers) ? d.teachers : [];
  const classes = Array.isArray(d.classes) ? d.classes : [];
  const directions = Array.isArray(d.directions) ? d.directions : [];
  const validCategories = new Set<DirectionCategory>(['adults', 'teens', 'ensemble', 'other']);
  return {
    teachers: teachers
      .filter((t) => t && typeof t === 'object')
      .map((t) => {
        const x = t as Record<string, unknown>;
        return {
          id: String(x.id ?? ''),
          name: String(x.name ?? ''),
          role: String(x.role ?? ''),
          experience: x.experience != null ? String(x.experience) : undefined,
          photoUrl: x.photoUrl != null ? String(x.photoUrl) : undefined,
        };
      })
      .filter((t) => t.id && t.name),
    classes: classes
      .filter((c) => c && typeof c === 'object')
      .map((c) => {
        const x = c as Record<string, unknown>;
        let day = Number(x.dayOfWeek);
        if (!Number.isFinite(day)) day = 1;
        day = Math.min(7, Math.max(1, Math.round(day)));
        return {
          id: String(x.id ?? ''),
          dayOfWeek: day,
          startTime: String(x.startTime ?? '09:00'),
          endTime: String(x.endTime ?? '10:00'),
          title: String(x.title ?? ''),
          teacherId: String(x.teacherId ?? ''),
          teacherName: x.teacherName != null ? String(x.teacherName) : undefined,
          hallName: x.hallName != null ? String(x.hallName) : undefined,
          impulseId: x.impulseId != null ? String(x.impulseId) : undefined,
          groupId: x.groupId != null ? Number(x.groupId) : undefined,
          syncedAt: x.syncedAt != null ? String(x.syncedAt) : undefined,
        };
      })
      .filter((c) => c.id && c.title),
    directions: directions
      .filter((x) => x && typeof x === 'object')
      .map((item) => {
        const x = item as Record<string, unknown>;
        const categoryRaw = String(x.category ?? 'other') as DirectionCategory;
        const category = validCategories.has(categoryRaw) ? categoryRaw : 'other';
        return {
          id: String(x.id ?? ''),
          category,
          title: String(x.title ?? ''),
          subtitle: String(x.subtitle ?? ''),
          description: String(x.description ?? ''),
          color: x.color != null ? String(x.color) : undefined,
          schedule: Boolean(x.schedule),
        };
      })
      .filter((x) => x.id && x.title),
  };
}

async function migrateFromJsonIfEmpty(): Promise<void> {
  if (!isCmsEmpty()) return;

  let payload = DEFAULT_CMS;
  try {
    const raw = await readFile(CMS_JSON_PATH, 'utf-8');
    payload = normalize(JSON.parse(raw));
  } catch {
    // используем данные по умолчанию
  }

  seedCmsData(payload);
}

export async function getCms(): Promise<CmsData> {
  ensureMigrated();
  await migrateFromJsonIfEmpty();
  return readCmsFromDb();
}

export async function saveCms(data: CmsData): Promise<void> {
  ensureMigrated();
  const next = normalize(data);
  writeCmsToDb({
    teachers: next.teachers,
    directions: next.directions,
    classes: [],
  });
}

export function parseCmsBody(body: unknown): CmsData {
  return normalize(body);
}
