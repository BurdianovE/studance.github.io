import type { APIRoute } from 'astro';
import { createSession, deleteExpiredSessions, loginUser } from '../../../lib/auth-db';
import { sessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, url }) => {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Некорректный JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  deleteExpiredSessions();
  const user = loginUser({
    email: body.email ?? '',
    password: body.password ?? '',
  });

  if (!user) {
    return new Response(JSON.stringify({ error: 'Неверный email или пароль' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { token, expiresAt } = createSession(user.id);
  return new Response(JSON.stringify({ ok: true, user }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': sessionCookie(token, expiresAt, url.protocol === 'https:'),
    },
  });
};
