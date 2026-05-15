import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const rows = await sql`
      SELECT ci.id, ci.quantity,
             p.id AS product_id, p.name, p.price, p.image_url, p.stock, p.is_available
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ${locals.user.userId}
      ORDER BY ci.id
    `;
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil keranjang' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const { productId, quantity = 1 } = await request.json();
    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID wajib diisi' }), { status: 400 });
    }

    // Check product exists and available
    const product = await sql`
      SELECT id, stock, is_available FROM products WHERE id = ${productId}
    `;
    if (!product.length || !product[0].is_available) {
      return new Response(JSON.stringify({ error: 'Produk tidak tersedia' }), { status: 400 });
    }

    await sql`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (${locals.user.userId}, ${productId}, ${quantity})
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    `;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menambah ke keranjang' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    await sql`DELETE FROM cart_items WHERE user_id = ${locals.user.userId}`;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengosongkan keranjang' }), { status: 500 });
  }
};
