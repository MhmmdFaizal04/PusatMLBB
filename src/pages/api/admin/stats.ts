import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const [todayVisitors] = await sql`
      SELECT COUNT(DISTINCT ip_hash)::int AS count
      FROM visitor_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;
    const [weekVisitors] = await sql`
      SELECT COUNT(DISTINCT ip_hash)::int AS count
      FROM visitor_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    const [totalCustomers] = await sql`
      SELECT COUNT(*)::int AS count FROM users WHERE role = 'customer' AND is_deleted = FALSE
    `;
    const [pendingOrders] = await sql`
      SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending_approval'
    `;
    const [totalRevenue] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::bigint AS total FROM orders WHERE status = 'approved'
    `;

    // Daily visitors last 14 days
    const dailyData = await sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(DISTINCT ip_hash)::int AS visitors
      FROM visitor_logs
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Orders per day last 14 days
    const ordersData = await sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS orders,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0)::bigint AS revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return new Response(
      JSON.stringify({
        todayVisitors: todayVisitors.count,
        weekVisitors: weekVisitors.count,
        totalCustomers: totalCustomers.count,
        pendingOrders: pendingOrders.count,
        totalRevenue: Number(totalRevenue.total),
        dailyData,
        ordersData,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil statistik' }), { status: 500 });
  }
};
