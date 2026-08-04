import { Client } from 'pg';

const NEW_URL =
  'postgresql://neondb_owner:npg_gOG2H9jdKLJu@ep-young-surf-avvvfygb.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ZALL-${part(4)}-${part(4)}`;
}

async function main() {
  const db = new Client({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // Find approved orders with cheat items but no keys
  const r = await db.query(`
    SELECT o.id AS order_id, oi.product_name, oi.cheat_duration, oi.quantity
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'approved'
      AND oi.cheat_duration IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM order_keys ok WHERE ok.order_id = o.id)
    ORDER BY o.created_at
  `);

  if (r.rows.length === 0) {
    console.log('Tidak ada order yang perlu diperbaiki.');
    await db.end();
    return;
  }

  console.log(`Memperbaiki ${r.rows.length} order item...\n`);

  for (const row of r.rows) {
    for (let q = 0; q < row.quantity; q++) {
      // Generate unique code
      let code = generateCode();
      for (let attempt = 0; attempt < 10; attempt++) {
        const exists = await db.query(`SELECT code FROM redeem_codes WHERE code = $1`, [code]);
        if (exists.rows.length === 0) break;
        code = generateCode();
      }

      // Insert into redeem_codes
      await db.query(
        `INSERT INTO redeem_codes (code, duration) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [code, row.cheat_duration]
      );

      // Insert into order_keys
      await db.query(
        `INSERT INTO order_keys (order_id, code, duration, product_name) VALUES ($1, $2, $3, $4)`,
        [row.order_id, code, row.cheat_duration, row.product_name]
      );

      console.log(`  Order ${row.order_id.slice(0, 8)}... → ${code} (${row.cheat_duration}) - ${row.product_name}`);
    }
  }

  console.log('\nSelesai! Semua key sudah digenerate dan akan muncul di halaman user.');
  await db.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
