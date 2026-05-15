import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

await sql.query(`ALTER TABLE qris_settings ADD COLUMN IF NOT EXISTS bypass_link TEXT`);
await sql.query(`ALTER TABLE qris_settings ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT`);

const rows = await sql`SELECT id, bypass_link, tutorial_video_url FROM qris_settings WHERE id = 1`;
console.log('Columns added. Current row:', rows[0]);
console.log('Done!');
