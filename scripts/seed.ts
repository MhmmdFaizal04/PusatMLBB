import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

await sql`INSERT INTO qris_settings (id) VALUES (1) ON CONFLICT DO NOTHING`;
await sql`INSERT INTO categories (name, slug) VALUES ('Mobile Legends', 'mobile-legends') ON CONFLICT (slug) DO NOTHING`;

const cats = await sql`SELECT * FROM categories`;
const qris = await sql`SELECT * FROM qris_settings`;
console.log('Categories:', JSON.stringify(cats));
console.log('QRIS:', JSON.stringify(qris));
console.log('Seed OK!');
