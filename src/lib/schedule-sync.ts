import type { ClassSlot } from './cms';
import {
  findTeacherByImpulseId,
  findTeacherByName,
  logSync,
  replaceSyncedClasses,
} from './cms-db';
import {
  fetchImpulseGroups,
  fetchImpulseSchedule,
  fetchImpulseTimetable,
  type ImpulseGroup,
  type ImpulseScheduleEntry,
  type ImpulseScheduleItem,
  type ImpulseTeacher,
} from './impulse-crm';

export interface SyncResult {
  ok: boolean;
  count: number;
  message: string;
}

function isActive(item: { deleted?: number | null; archived?: number | null }): boolean {
  return !item.deleted && !item.archived;
}

function formatTeacherName(teacher?: ImpulseTeacher | null): string {
  if (!teacher) return '';
  if (teacher.fio) return teacher.fio;
  const parts = [teacher.lastName, teacher.firstName, teacher.name].filter(Boolean);
  return parts.join(' ').trim();
}

function normalizeTime(value: unknown): string {
  if (value == null) return '00:00';
  const raw = String(value).trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  const minutes = Number(raw);
  if (Number.isFinite(minutes) && minutes >= 0) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return '00:00';
}

function normalizeDay(value: unknown): number | null {
  const day = Number(value);
  if (!Number.isFinite(day)) return null;
  if (day >= 1 && day <= 7) return Math.round(day);
  if (day >= 0 && day <= 6) return day === 0 ? 7 : Math.round(day);
  return null;
}

function resolveTeacherId(teacher?: ImpulseTeacher | null, fallbackName?: string): {
  id: string;
  name: string;
} {
  const name = formatTeacherName(teacher) || fallbackName || '';
  if (teacher?.id) {
    const linked = findTeacherByImpulseId(teacher.id);
    if (linked) return { id: linked, name };
  }
  if (name) {
    const linked = findTeacherByName(name);
    if (linked) return { id: linked, name };
  }
  return { id: '', name };
}

function makeSlotId(parts: Array<string | number | undefined | null>): string {
  return parts.filter((p) => p != null && p !== '').join(':');
}

function pushSlot(
  slots: Map<string, ClassSlot>,
  slot: Omit<ClassSlot, 'id'> & { id?: string }
): void {
  const id = slot.id ?? makeSlotId([slot.impulseId, slot.groupId, slot.dayOfWeek, slot.startTime, slot.title]);
  if (!id || !slot.title) return;
  slots.set(id, { ...slot, id });
}

function slotsFromScheduleArray(
  entries: ImpulseScheduleEntry[] | ImpulseScheduleEntry | null | undefined,
  context: {
    title: string;
    groupId?: number;
    teacher?: ImpulseTeacher | null;
    hallName?: string;
    impulsePrefix: string;
  }
): ClassSlot[] {
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];
  const result: ClassSlot[] = [];

  for (const entry of list) {
    const day = normalizeDay(entry.dayOfWeek ?? entry.weekDay ?? entry.day);
    if (!day) continue;
    const startTime = normalizeTime(
      entry.timeBegin ?? entry.timeStart ?? entry.startTime ?? entry.minutesBegin
    );
    const endTime = normalizeTime(entry.timeEnd ?? entry.endTime ?? entry.minutesEnd);
    const teacher = resolveTeacherId(context.teacher);
    const impulseId = makeSlotId([context.impulsePrefix, entry.id ?? '', context.groupId, day, startTime]);

    result.push({
      id: impulseId,
      dayOfWeek: day,
      startTime,
      endTime: endTime === '00:00' ? addHour(startTime) : endTime,
      title: context.title,
      teacherId: teacher.id,
      teacherName: teacher.name || undefined,
      hallName: context.hallName,
      impulseId,
      groupId: context.groupId,
    });
  }

  return result;
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(23, (h || 0) + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

function slotsFromGroup(group: ImpulseGroup): ClassSlot[] {
  if (!isActive(group)) return [];
  const title = String(group.name ?? group.title ?? group.style?.name ?? '').trim();
  if (!title) return [];

  const teacher = (group.teacher as ImpulseTeacher | null) ?? null;
  const hallName = group.hall?.name;
  const fromSchedule = slotsFromScheduleArray(group.schedule, {
    title,
    groupId: group.id,
    teacher,
    hallName,
    impulsePrefix: `group-${group.id}`,
  });
  if (fromSchedule.length > 0) return fromSchedule;

  const day = normalizeDay(group.dayOfWeek ?? group.weekDay ?? group.day);
  if (!day) return [];

  const startTime = normalizeTime(group.timeBegin ?? group.timeStart ?? group.startTime);
  const endTime = normalizeTime(group.timeEnd ?? group.endTime);
  const teacherResolved = resolveTeacherId(teacher);
  const impulseId = makeSlotId(['group', group.id, day, startTime]);

  return [
    {
      id: impulseId,
      dayOfWeek: day,
      startTime,
      endTime: endTime === '00:00' ? addHour(startTime) : endTime,
      title,
      teacherId: teacherResolved.id,
      teacherName: teacherResolved.name || undefined,
      hallName,
      impulseId,
      groupId: group.id,
    },
  ];
}

function slotsFromScheduleItem(item: ImpulseScheduleItem): ClassSlot[] {
  if (!isActive(item)) return [];

  const group = item.group && typeof item.group === 'object' ? (item.group as ImpulseGroup) : null;
  const title = String(
    item.name ?? item.title ?? group?.name ?? group?.title ?? item.style?.name ?? ''
  ).trim();
  if (!title) return [];

  const teacher = (item.teacher as ImpulseTeacher | null) ?? (group?.teacher as ImpulseTeacher | null);
  const hallName = item.hall?.name ?? group?.hall?.name;
  const groupId = group?.id;

  if (group?.schedule) {
    return slotsFromScheduleArray(group.schedule, {
      title,
      groupId,
      teacher,
      hallName,
      impulsePrefix: `schedule-${item.id}`,
    });
  }

  const day = normalizeDay(item.dayOfWeek ?? item.weekDay ?? item.day ?? group?.dayOfWeek ?? group?.day);
  if (!day) return [];

  const startTime = normalizeTime(
    item.timeBegin ?? item.timeStart ?? item.startTime ?? group?.timeBegin ?? group?.timeStart
  );
  const endTime = normalizeTime(item.timeEnd ?? item.endTime ?? group?.timeEnd ?? group?.endTime);
  const teacherResolved = resolveTeacherId(teacher);
  const impulseId = makeSlotId(['schedule', item.id, day, startTime]);

  return [
    {
      id: impulseId,
      dayOfWeek: day,
      startTime,
      endTime: endTime === '00:00' ? addHour(startTime) : endTime,
      title,
      teacherId: teacherResolved.id,
      teacherName: teacherResolved.name || undefined,
      hallName,
      impulseId,
      groupId,
    },
  ];
}

function collectSlots(groups: ImpulseGroup[], schedule: ImpulseScheduleItem[], timetable: ImpulseScheduleItem[]): ClassSlot[] {
  const map = new Map<string, ClassSlot>();

  for (const group of groups) {
    for (const slot of slotsFromGroup(group)) {
      pushSlot(map, slot);
    }
  }

  for (const item of schedule) {
    for (const slot of slotsFromScheduleItem(item)) {
      pushSlot(map, slot);
    }
  }

  for (const item of timetable) {
    for (const slot of slotsFromScheduleItem(item)) {
      pushSlot(map, slot);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });
}

export async function syncScheduleFromImpulseCrm(): Promise<SyncResult> {
  try {
    const [groups, schedule, timetable] = await Promise.all([
      fetchImpulseGroups().catch(() => [] as ImpulseGroup[]),
      fetchImpulseSchedule().catch(() => [] as ImpulseScheduleItem[]),
      fetchImpulseTimetable().catch(() => [] as ImpulseScheduleItem[]),
    ]);

    const slots = collectSlots(groups, schedule, timetable);
    if (slots.length === 0) {
      const message = 'ImpulseCRM не вернул занятий. Проверьте API-ключ и расписание в CRM.';
      logSync('impulsecrm', 'error', message, 0);
      return { ok: false, count: 0, message };
    }

    const count = replaceSyncedClasses(slots);
    const message = `Синхронизировано занятий: ${count}`;
    logSync('impulsecrm', 'ok', message, count);
    return { ok: true, count, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка синхронизации';
    logSync('impulsecrm', 'error', message, 0);
    return { ok: false, count: 0, message };
  }
}
