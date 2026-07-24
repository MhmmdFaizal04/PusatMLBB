import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const rows = await sql`
      SELECT ci.id, ci.quantity, ci.cheat_duration,
             p.id AS product_id, p.name, p.image_url, p.stock, p.is_available,
             COALESCE(cap.price, p.price) AS price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      LEFT JOIN cheat_app_prices cap
        ON cap.product_id = p.id AND cap.duration = ci.cheat_duration
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
    const { productId, quantity = 1, cheatDuration } = await request.json();
    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID wajib diisi' }), { status: 400 });
    }

    // Check product exists and available
    const product = await sql`
      SELECT p.id, p.stock, p.is_available, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${productId}
    `;
    if (!product.length || !product[0].is_available) {
      return new Response(JSON.stringify({ error: 'Produk tidak tersedia' }), { status: 400 });
    }

    const isCheat = product[0].category_slug === 'cheat-app';

    // Validate cheat duration if it's a cheat app product
    let validDuration: string | null = null;
    if (isCheat) {
      if (!cheatDuration) {
        return new Response(JSON.stringify({ error: 'Pilih durasi akses terlebih dahulu' }), { status: 400 });
      }
      const priceRow = await sql`
        SELECT price FROM cheat_app_prices WHERE product_id = ${productId} AND duration = ${cheatDuration} AND price > 0
      `;
      if (!priceRow.length) {
        return new Response(JSON.stringify({ error: 'Durasi tidak tersedia untuk produk ini' }), { status: 400 });
      }
      validDuration = cheatDuration;
    }

    // For cheat app: each duration is a separate cart entry (unique by product+duration)
    // For regular products: unique by product only
    if (isCheat && validDuration) {
      await sql`
        INSERT INTO cart_items (user_id, product_id, quantity, cheat_duration)
        VALUES (${locals.user.userId}, ${productId}, ${quantity}, ${validDuration})
        ON CONFLICT (user_id, product_id)
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                      cheat_duration = EXCLUDED.cheat_duration
      `;
    } else {
      await sql`
        INSERT INTO cart_items (user_id, product_id, quantity)
        VALUES (${locals.user.userId}, ${productId}, ${quantity})
        ON CONFLICT (user_id, product_id)
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
      `;
    }

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
