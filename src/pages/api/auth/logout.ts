import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth-db';
import { clearSessionCookie, readSessionToken } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, url }) => {
  const token = readSessionToken(request.headers.get('cookie'));
  deleteSession(token);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(url.protocol === 'https:'),
    },
  });
};
