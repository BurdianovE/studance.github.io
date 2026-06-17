export interface ImpulseListResponse<T> {
  total: number;
  items: T[];
}

export interface ImpulseRef {
  id: number;
  name?: string;
  entity?: string;
  fio?: string;
  lastName?: string;
  firstName?: string;
}

export interface ImpulseTeacher extends ImpulseRef {
  post?: string;
  fotoUrl?: string;
  fotoThumbUrl?: string;
}

export interface ImpulseScheduleEntry {
  id?: number;
  day?: number;
  dayOfWeek?: number;
  weekDay?: number;
  timeBegin?: string;
  timeEnd?: string;
  timeStart?: string;
  startTime?: string;
  endTime?: string;
  minutesBegin?: number;
  minutesEnd?: number;
}

export interface ImpulseGroup {
  id: number;
  name?: string;
  title?: string;
  entity?: string;
  teacher?: ImpulseRef | ImpulseTeacher | null;
  style?: ImpulseRef | null;
  hall?: ImpulseRef | null;
  schedule?: ImpulseScheduleEntry[] | ImpulseScheduleEntry | null;
  day?: number;
  dayOfWeek?: number;
  weekDay?: number;
  timeBegin?: string;
  timeEnd?: string;
  timeStart?: string;
  startTime?: string;
  endTime?: string;
  deleted?: number | null;
  archived?: number | null;
}

export interface ImpulseScheduleItem {
  id: number;
  entity?: string;
  name?: string;
  title?: string;
  day?: number;
  dayOfWeek?: number;
  weekDay?: number;
  timeBegin?: string;
  timeEnd?: string;
  timeStart?: string;
  startTime?: string;
  endTime?: string;
  group?: ImpulseGroup | ImpulseRef | null;
  teacher?: ImpulseRef | ImpulseTeacher | null;
  hall?: ImpulseRef | null;
  style?: ImpulseRef | null;
  deleted?: number | null;
  archived?: number | null;
}

function getConfig() {
  const baseUrl = import.meta.env.IMPULSE_CRM_URL ?? 'https://studancemskadgmailcom.impulsecrm.ru';
  const apiKey = import.meta.env.IMPULSE_CRM_API_KEY;
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
}

function authHeader(apiKey: string): string {
  const token = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${token}`;
}

async function impulseList<T>(entity: string, body: Record<string, unknown> = {}): Promise<T[]> {
  const { baseUrl, apiKey } = getConfig();
  if (!apiKey) {
    throw new Error('IMPULSE_CRM_API_KEY не задан в .env');
  }

  const items: T[] = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const res = await fetch(`${baseUrl}/api/public/${entity}/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authHeader(apiKey),
      },
      body: JSON.stringify({ ...body, page, limit }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ImpulseCRM ${entity}/list: ${res.status} ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as ImpulseListResponse<T>;
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);

    if (batch.length < limit) break;
    page += 1;
    if (page > 50) break;
  }

  return items;
}

export async function fetchImpulseTeachers(): Promise<ImpulseTeacher[]> {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/api/public/teacher/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`ImpulseCRM teacher/list: ${res.status}`);
  }
  const data = (await res.json()) as ImpulseListResponse<ImpulseTeacher>;
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchImpulseGroups(): Promise<ImpulseGroup[]> {
  return impulseList<ImpulseGroup>('group');
}

export async function fetchImpulseSchedule(): Promise<ImpulseScheduleItem[]> {
  return impulseList<ImpulseScheduleItem>('schedule');
}

export async function fetchImpulseTimetable(): Promise<ImpulseScheduleItem[]> {
  return impulseList<ImpulseScheduleItem>('timetable');
}
