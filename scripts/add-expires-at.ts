import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

await sql.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);

console.log('Column expires_at added to orders table.');
console.log('Done!');
