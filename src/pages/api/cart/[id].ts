import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const PUT: APIRoute = async ({ request, params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const { quantity } = await request.json();
    if (!quantity || quantity < 1) {
      return new Response(JSON.stringify({ error: 'Jumlah tidak valid' }), { status: 400 });
    }
    await sql`
      UPDATE cart_items SET quantity = ${quantity}
      WHERE id = ${params.id!} AND user_id = ${locals.user.userId}
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengupdate keranjang' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    await sql`
      DELETE FROM cart_items WHERE id = ${params.id!} AND user_id = ${locals.user.userId}
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menghapus item' }), { status: 500 });
  }
};
