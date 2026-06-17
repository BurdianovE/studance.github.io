import type { APIRoute } from 'astro';
import { createSession, deleteExpiredSessions, registerUser } from '../../../lib/auth-db';
import { sessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, url }) => {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; name?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Некорректный JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    deleteExpiredSessions();
    const user = registerUser({
      email: body.email ?? '',
      password: body.password ?? '',
      name: body.name ?? '',
    });
    const { token, expiresAt } = createSession(user.id);
    return new Response(JSON.stringify({ ok: true, user }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': sessionCookie(token, expiresAt, url.protocol === 'https:'),
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Ошибка регистрации',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
};
