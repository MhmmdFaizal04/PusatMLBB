import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_zjC6gPK0YViH@ep-bitter-sunset-aqi1xl19.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

// Test: call sql() directly as a function with a string
try {
  const r = await (sql as any)('CREATE TABLE IF NOT EXISTS _test2 (id SERIAL PRIMARY KEY)');
  console.log('Direct call CREATE result:', r);
  
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log('Tables after create:', tables.map((t: any) => t.tablename));
  
  await (sql as any)('DROP TABLE IF EXISTS _test2');
  console.log('Drop done');
} catch(e: any) {
  console.error('Error:', e.message);
}

