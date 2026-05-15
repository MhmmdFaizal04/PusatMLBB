import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

export const PUT: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    // Only the order owner can mark as reminded
    await sql`
      UPDATE orders
      SET wa_reminded_at = NOW()
      WHERE id = ${params.id!} AND user_id = ${locals.user.userId}
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal' }), { status: 500 });
  }
};
