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

    const order = rows[0];

    await sql`
      UPDATE orders SET status = 'approved', expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
      WHERE id = ${params.id!}
    `;

    // Kurangi stok hanya jika sebelumnya masih pending (hindari double-kurang)
    if (order.status === 'pending') {
      const items = await sql`
        SELECT product_id, quantity FROM order_items
        WHERE order_id = ${params.id!} AND product_id IS NOT NULL
      `;
      for (const item of items as any[]) {
        await sql`
          UPDATE products
          SET stock = GREATEST(stock - ${item.quantity}, 0)
          WHERE id = ${item.product_id}
        `;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menyetujui pesanan' }), { status: 500 });
  }
};
