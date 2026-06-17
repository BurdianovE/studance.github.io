import type { APIRoute } from 'astro';
import { getUserBySessionToken } from '../../../lib/auth-db';
import { readSessionToken } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const token = readSessionToken(request.headers.get('cookie'));
  const user = getUserBySessionToken(token);

  if (!user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
