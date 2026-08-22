/**
 * fix-sequences.ts
 * Reset SERIAL sequences after manual data migration.
 * Run ONCE on the NEW database after migrate-to-new-db.ts completes.
 *
 * Usage: npx tsx scripts/fix-sequences.ts
 */
import { Client } from 'pg';

const NEW_URL =
  'postgresql://neondb_owner:npg_SnMyV6qDNkd8@ep-spring-base-avu9tr3n.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const db = new Client({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('Connected to new DB');

  // Reset each SERIAL/BIGSERIAL sequence to MAX(id) so new inserts don't conflict
  const tables: [string, string][] = [
    ['order_keys',    'order_keys_id_seq'],
    ['app_version',   'app_version_id_seq'],
    ['visitor_logs',  'visitor_logs_id_seq'],
    ['categories',    'categories_id_seq'],
    // qris_settings uses integer PK default 1, no sequence to reset
  ];

  for (const [table, seq] of tables) {
    const r = await db.query(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`);
    const maxId = parseInt(r.rows[0].max_id, 10);
    await db.query(`SELECT setval('${seq}', $1)`, [Math.max(maxId, 1)]);
    console.log(`  ${table}: sequence reset to ${Math.max(maxId, 1)}`);
  }

  await db.end();
  console.log('\nAll sequences fixed. New inserts will no longer conflict.');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
