import type { APIRoute } from 'astro';
import { getLastSyncInfo } from '../../../lib/cms-db';
import { syncScheduleFromImpulseCrm } from '../../../lib/schedule-sync';

function checkAdminToken(request: Request): Response | null {
  const token = import.meta.env.ADMIN_TOKEN;
  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ error: 'ADMIN_TOKEN не задан в .env' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const auth = request.headers.get('x-admin-token');
  if (auth !== token) {
    return new Response(JSON.stringify({ error: 'Неверный пароль' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return null;
}

export const GET: APIRoute = async () => {
  const last = getLastSyncInfo();
  return new Response(JSON.stringify({ last }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = checkAdminToken(request);
  if (denied) return denied;

  const result = await syncScheduleFromImpulseCrm();
  const status = result.ok ? 200 : 502;

  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
