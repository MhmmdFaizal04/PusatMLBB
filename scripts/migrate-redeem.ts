/**
 * Run once: creates redeem_codes and device_vip tables
 * Usage: npx tsx scripts/migrate-redeem.ts
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const rawUrl: string = process.env.DATABASE_URL ?? '';
if (!rawUrl) throw new Error('DATABASE_URL is not set');
const dbUrl = rawUrl.replace('channel_binding=require&', '').replace('&channel_binding=require', '').replace('?channel_binding=require', '');
const sql = neon(dbUrl);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS redeem_codes (
      code        VARCHAR(20) PRIMARY KEY,
      duration    VARCHAR(20) NOT NULL,
      used        BOOLEAN DEFAULT false,
      used_by     VARCHAR(150),
      used_at     TIMESTAMP,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ Table redeem_codes created (or already exists)');

  await sql`
    CREATE TABLE IF NOT EXISTS device_vip (
      device_id   VARCHAR(150) PRIMARY KEY,
      vip_until   TIMESTAMP,
      tier        VARCHAR(10) DEFAULT 'free',
      updated_at  TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ Table device_vip created (or already exists)');
}

main().catch(console.error);
