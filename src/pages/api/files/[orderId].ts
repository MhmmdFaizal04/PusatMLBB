import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { orderId } = params;
    const url = new URL(request.url);
    const pidRaw = url.searchParams.get('pid');

    // Basic UUID format validation to reject obviously invalid input
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || !pidRaw || !uuidRegex.test(orderId) || !uuidRegex.test(pidRaw)) {
      return new Response('Not Found', { status: 404 });
    }

    // Validate on every request: order must still be approved, not expired, belong to this user
    const rows = (await sql`
      SELECT p.download_link
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.id = ${orderId}
        AND o.user_id = ${user.userId}
        AND o.status = 'approved'
        AND (o.expires_at IS NULL OR o.expires_at > NOW())
        AND oi.product_id = ${pidRaw}
        AND p.download_link IS NOT NULL
      LIMIT 1
    `) as any[];

    if (!rows.length || !rows[0].download_link) {
      return new Response('Akses ditolak. Pesanan tidak valid atau sudah dibatalkan.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Redirect to MediaFire — the actual URL is never exposed to the browser
    return new Response(null, {
      status: 302,
      headers: { Location: rows[0].download_link },
    });
  } catch (err) {
    console.error('[files proxy]', err);
    return new Response('Terjadi kesalahan server', { status: 500 });
  }
};
