import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { randomInt } from 'node:crypto';

function generateRedeemCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[randomInt(0, chars.length)]).join('');
  return `ZALL-${part(4)}-${part(4)}`;
}

export const PUT: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    // Atomic update: only update and proceed if order exists AND is not yet approved
    const updateResult = (await sql`
      UPDATE orders
      SET status = 'approved', expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
      WHERE id = ${params.id!} AND status != 'approved'
      RETURNING id
    `) as any[];

    if (!updateResult.length) {
      // Check if it exists and was already approved, or doesn't exist
      const existing = await sql`SELECT id, status FROM orders WHERE id = ${params.id!}`;
      if (!existing.length) {
        return new Response(JSON.stringify({ error: 'Pesanan tidak ditemukan' }), { status: 404 });
      }
      return new Response(JSON.stringify({ ok: true, message: 'Pesanan sudah disetujui sebelumnya' }), { status: 200 });
    }

    // Only the single thread that successfully updated status executes this block
    const items = await sql`
      SELECT oi.id AS item_id, oi.product_id, oi.quantity, oi.product_name,
             oi.cheat_duration
      FROM order_items oi
      WHERE oi.order_id = ${params.id!}
    `;

      for (const item of items as any[]) {
        // Kurangi stok untuk semua produk
        if (item.product_id) {
          await sql`
            UPDATE products
            SET stock = GREATEST(stock - ${item.quantity}, 0)
            WHERE id = ${item.product_id}
          `;
        }

        // Generate redeem key untuk Cheat App products
        if (item.cheat_duration) {
          // Generate one code per quantity purchased
          for (let q = 0; q < item.quantity; q++) {
            let code = generateRedeemCode();
            // Ensure uniqueness — retry up to 5 times
            for (let attempt = 0; attempt < 5; attempt++) {
              const existing = await sql`SELECT code FROM redeem_codes WHERE code = ${code}`;
              if (existing.length === 0) break;
              code = generateRedeemCode();
            }
            // Insert into redeem_codes
            await sql`
              INSERT INTO redeem_codes (code, duration)
              VALUES (${code}, ${item.cheat_duration})
              ON CONFLICT (code) DO NOTHING
            `;
            // Insert into order_keys
            await sql`
              INSERT INTO order_keys (order_id, code, duration, product_name)
              VALUES (${params.id!}, ${code}, ${item.cheat_duration}, ${item.product_name})
            `;
          }
        }
      }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal menyetujui pesanan' }), { status: 500 });
  }
};
