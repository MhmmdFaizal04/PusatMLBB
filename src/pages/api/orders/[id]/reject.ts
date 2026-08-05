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

    // If order was previously approved, invalidate any generated redeem keys
    if ((rows[0] as any).status === 'approved') {
      const keys = await sql`SELECT code FROM order_keys WHERE order_id = ${params.id!}`;
      const codes = (keys as any[]).map((k) => k.code);
      if (codes.length > 0) {
        await sql`DELETE FROM redeem_codes WHERE code = ANY(${codes})`;
        await sql`DELETE FROM order_keys WHERE order_id = ${params.id!}`;
      }
    }

    await sql`
      UPDATE orders SET status = 'rejected', updated_at = NOW()
      WHERE id = ${params.id!}
    `;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menolak pesanan' }), { status: 500 });
  }
};
