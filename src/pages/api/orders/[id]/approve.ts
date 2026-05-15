import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

export const PUT: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const rows = await sql`SELECT id, status FROM orders WHERE id = ${params.id!}`;
    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'Pesanan tidak ditemukan' }), { status: 404 });
    }
    await sql`
      UPDATE orders SET status = 'approved', updated_at = NOW()
      WHERE id = ${params.id!}
    `;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menyetujui pesanan' }), { status: 500 });
  }
};
