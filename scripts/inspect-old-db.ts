import { Client } from 'pg';

const OLD_URL =
  'postgresql://neondb_owner:npg_zjC6gPK0YViH@ep-bitter-sunset-aqi1xl19.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

const db = new Client({ connectionString: OLD_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await db.connect();
  const r = await db.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );
  let lastTable = '';
  for (const row of r.rows) {
    if (row.table_name !== lastTable) {
      console.log(`\n[${row.table_name}]`);
      lastTable = row.table_name;
    }
    console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}`);
  }
  await db.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
