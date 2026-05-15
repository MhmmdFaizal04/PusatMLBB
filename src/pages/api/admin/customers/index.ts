import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const rows = await sql`
      SELECT id, email, username, created_at,
             (SELECT COUNT(*)::int FROM orders WHERE user_id = users.id) AS order_count
      FROM users
      WHERE role = 'customer' AND is_deleted = FALSE
      ORDER BY created_at DESC
    `;
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil data customer' }), {
      status: 500,
    });
  }
};
