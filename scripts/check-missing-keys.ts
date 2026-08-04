import { Client } from 'pg';

const NEW_URL =
  'postgresql://neondb_owner:npg_gOG2H9jdKLJu@ep-young-surf-avvvfygb.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const db = new Client({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // Orders yang approved tapi punya cheat_duration di order_items tapi tidak ada di order_keys
  const r = await db.query(`
    SELECT DISTINCT o.id AS order_id, o.status, o.created_at,
           oi.product_name, oi.cheat_duration, oi.quantity
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'approved'
      AND oi.cheat_duration IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_keys ok WHERE ok.order_id = o.id
      )
    ORDER BY o.created_at DESC
  `);

  console.log(`\nOrders approved + cheat item tapi TIDAK ADA key: ${r.rows.length}`);
  r.rows.forEach(row => {
    console.log(`  Order: ${row.order_id} | ${row.product_name} (${row.cheat_duration}) x${row.quantity}`);
  });

  // Total order_keys di DB baru
  const total = await db.query(`SELECT COUNT(*) FROM order_keys`);
  console.log(`\nTotal order_keys di DB baru: ${total.rows[0].count}`);

  await db.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
