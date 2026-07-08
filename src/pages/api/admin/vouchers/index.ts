import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

// GET /api/admin/vouchers — list all vouchers
export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  try {
    const vouchers = await sql`
      SELECT v.*,
        COALESCE(
          json_agg(json_build_object('id', p.id, 'name', p.name)) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS products
      FROM vouchers v
      LEFT JOIN voucher_products vp ON vp.voucher_id = v.id
      LEFT JOIN products p ON p.id = vp.product_id
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `;
    return new Response(JSON.stringify(vouchers), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil data voucher' }), { status: 500 });
  }
};

// POST /api/admin/vouchers — create voucher
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  try {
    const body = await request.json();
    const { code, discount_type, discount_value, max_uses, applies_to, product_ids, expires_at } = body;

    if (!code || !discount_type || !discount_value) {
      return new Response(JSON.stringify({ error: 'Kode, tipe, dan nilai diskon wajib diisi' }), { status: 400 });
    }

    const cleanCode = String(code).toUpperCase().trim();
    if (!/^[A-Z0-9_-]{3,30}$/.test(cleanCode)) {
      return new Response(JSON.stringify({ error: 'Kode voucher hanya boleh huruf kapital, angka, _ dan - (3-30 karakter)' }), { status: 400 });
    }

    const expiresAtVal = expires_at ? new Date(expires_at) : null;

    const rows = await sql`
      INSERT INTO vouchers (code, discount_type, discount_value, max_uses, applies_to, expires_at)
      VALUES (
        ${cleanCode},
        ${discount_type},
        ${Number(discount_value)},
        ${max_uses ? Number(max_uses) : null},
        ${applies_to || 'all'},
        ${expiresAtVal}
      )
      RETURNING id
    `;

    const voucherId = rows[0].id;

    if (applies_to === 'specific' && Array.isArray(product_ids) && product_ids.length > 0) {
      for (const pid of product_ids) {
        await sql`
          INSERT INTO voucher_products (voucher_id, product_id)
          VALUES (${voucherId}, ${pid})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    return new Response(JSON.stringify({ ok: true, id: voucherId }), { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('unique')) {
      return new Response(JSON.stringify({ error: 'Kode voucher sudah digunakan' }), { status: 409 });
    }
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal membuat voucher' }), { status: 500 });
  }
};
