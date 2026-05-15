import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    // Soft delete
    await sql`
      UPDATE users SET is_deleted = TRUE WHERE id = ${params.id!} AND role = 'customer'
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menghapus customer' }), { status: 500 });
  }
};
