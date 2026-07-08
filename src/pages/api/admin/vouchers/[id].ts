import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

// PATCH /api/admin/vouchers/[id] — toggle active / update
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { id } = params;
  try {
    const body = await request.json();

    if (typeof body.is_active === 'boolean') {
      await sql`UPDATE vouchers SET is_active = ${body.is_active} WHERE id = ${id!}`;
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal update voucher' }), { status: 500 });
  }
};

// DELETE /api/admin/vouchers/[id]
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { id } = params;
  try {
    await sql`DELETE FROM vouchers WHERE id = ${id!}`;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal hapus voucher' }), { status: 500 });
  }
};
