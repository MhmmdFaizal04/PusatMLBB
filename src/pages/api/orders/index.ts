import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = 10;
    const offset = (page - 1) * limit;

    const isAdmin = locals.user.role === 'admin';
    const rows = isAdmin
      ? await sql`
          SELECT o.*, u.username, u.email
          FROM orders o
          JOIN users u ON u.id = o.user_id
          ORDER BY o.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT o.*
          FROM orders o
          WHERE o.user_id = ${locals.user.userId}
          ORDER BY o.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    // Get order items for each order
    const orderIds = rows.map((r: any) => r.id as string);
    let items: Array<Record<string, unknown>> = [];
    if (orderIds.length > 0) {
      items = await sql`
        SELECT oi.*, p.download_link
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ANY(${orderIds})
      `;
    }

    const ordersWithItems = rows.map((order: Record<string, unknown>) => ({
      ...order,
      items: items.filter((i: Record<string, unknown>) => i.order_id === order.id),
    }));

    return new Response(JSON.stringify(ordersWithItems), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil pesanan' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const { proofUrl, proofPublicId } = await request.json();
    if (!proofUrl) {
      return new Response(JSON.stringify({ error: 'Bukti pembayaran wajib diupload' }), {
        status: 400,
      });
    }

    // Get cart items
    const cartItems = await sql`
      SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.stock, p.is_available
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ${locals.user.userId}
    `;

    if (!cartItems.length) {
      return new Response(JSON.stringify({ error: 'Keranjang kosong' }), { status: 400 });
    }

    const unavailable = cartItems.filter(
      (i: Record<string, unknown>) => !i.is_available || (i.stock as number) < 1,
    );
    if (unavailable.length > 0) {
      return new Response(
        JSON.stringify({ error: `Produk "${(unavailable[0] as { name: string }).name}" tidak tersedia` }),
        { status: 400 },
      );
    }

    const total = cartItems.reduce(
      (sum: number, i: Record<string, unknown>) =>
        sum + (i.price as number) * (i.quantity as number),
      0,
    );

    // Create order
    const orderRows = await sql`
      INSERT INTO orders (user_id, total_amount, status, proof_image_url, proof_public_id)
      VALUES (${locals.user.userId}, ${total}, 'pending_approval', ${proofUrl}, ${proofPublicId})
      RETURNING id
    `;
    const orderId = orderRows[0].id;

    // Insert order items
    for (const item of cartItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, product_name)
        VALUES (${orderId}, ${(item as Record<string, unknown>).product_id}, ${(item as Record<string, unknown>).quantity},
                ${(item as Record<string, unknown>).price}, ${(item as Record<string, unknown>).name})
      `;
    }

    // Clear cart
    await sql`DELETE FROM cart_items WHERE user_id = ${locals.user.userId}`;

    return new Response(JSON.stringify({ ok: true, orderId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal membuat pesanan' }), { status: 500 });
  }
};
