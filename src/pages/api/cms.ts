import type { APIRoute } from 'astro';
import { getCms, parseCmsBody, saveCms } from '../../lib/cms';

export const GET: APIRoute = async () => {
  const data = await getCms();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

export const POST: APIRoute = async ({ request }) => {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Некорректный JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const next = parseCmsBody(body);
  await saveCms(next);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
