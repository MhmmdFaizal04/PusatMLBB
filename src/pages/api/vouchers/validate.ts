import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

// POST /api/vouchers/validate — validate voucher code for current cart
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  try {
    const { code } = await request.json();
    if (!code) return new Response(JSON.stringify({ error: 'Kode voucher kosong' }), { status: 400 });

    const cleanCode = String(code).toUpperCase().trim();

    const rows = await sql`
      SELECT v.*,
        COALESCE(
          json_agg(vp.product_id::text) FILTER (WHERE vp.product_id IS NOT NULL),
          '[]'
        ) AS allowed_product_ids
      FROM vouchers v
      LEFT JOIN voucher_products vp ON vp.voucher_id = v.id
      WHERE v.code = ${cleanCode}
      GROUP BY v.id
    `;

    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'Kode voucher tidak ditemukan' }), { status: 404 });
    }

    const voucher = rows[0] as any;

    if (!voucher.is_active) {
      return new Response(JSON.stringify({ error: 'Voucher sudah tidak aktif' }), { status: 400 });
    }

    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Voucher sudah kadaluarsa' }), { status: 400 });
    }

    if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
      return new Response(JSON.stringify({ error: 'Voucher sudah mencapai batas pemakaian' }), { status: 400 });
    }

    // Get cart items to check product eligibility & compute discount
    const cartItems = await sql`
      SELECT ci.quantity, p.id AS product_id, p.name, p.price
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ${locals.user.userId}
    `;

    if (!cartItems.length) {
      return new Response(JSON.stringify({ error: 'Keranjang kosong' }), { status: 400 });
    }

    // Filter eligible items
    const allowedIds: string[] = voucher.allowed_product_ids;
    const eligibleItems = voucher.applies_to === 'specific'
      ? cartItems.filter((i: any) => allowedIds.includes(i.product_id))
      : cartItems;

    if (!eligibleItems.length) {
      return new Response(JSON.stringify({ error: 'Voucher tidak berlaku untuk produk di keranjang kamu' }), { status: 400 });
    }

    const eligibleSubtotal = eligibleItems.reduce(
      (s: number, i: any) => s + i.price * i.quantity, 0
    );
    const totalCart = cartItems.reduce(
      (s: number, i: any) => s + i.price * i.quantity, 0
    );

    let discountAmount = 0;
    if (voucher.discount_type === 'percent') {
      discountAmount = Math.floor(eligibleSubtotal * voucher.discount_value / 100);
    } else {
      discountAmount = Math.min(voucher.discount_value, eligibleSubtotal);
    }

    const finalTotal = totalCart - discountAmount;

    return new Response(JSON.stringify({
      ok: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        discount_type: voucher.discount_type,
        discount_value: voucher.discount_value,
        applies_to: voucher.applies_to,
      },
      discount_amount: discountAmount,
      original_total: totalCart,
      final_total: finalTotal,
    }), { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal validasi voucher' }), { status: 500 });
  }
};
