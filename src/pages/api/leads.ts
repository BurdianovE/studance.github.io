import type { APIRoute } from 'astro';
import { createLead } from '../../lib/leads-db';

export const POST: APIRoute = async ({ request }) => {
  let body: { name?: string; phone?: string; direction?: string };
  try {
    body = (await request.json()) as { name?: string; phone?: string; direction?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Некорректный JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const lead = createLead({
      name: body.name ?? '',
      phone: body.phone ?? '',
      direction: body.direction ?? '',
    });
    return new Response(JSON.stringify({ ok: true, lead }), {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Не удалось сохранить заявку',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
};
