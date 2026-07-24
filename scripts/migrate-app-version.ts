/**
 * Run once: creates app_version table and seeds initial data
 * Usage: npx tsx scripts/migrate-app-version.ts
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const rawUrl: string = process.env.DATABASE_URL ?? '';
if (!rawUrl) throw new Error('DATABASE_URL is not set');
const dbUrl = rawUrl
  .replace('channel_binding=require&', '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require', '');
const sql = neon(dbUrl);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_version (
      id             SERIAL PRIMARY KEY,
      force_update   BOOLEAN DEFAULT false,
      latest_version VARCHAR(20) NOT NULL,
      min_version    VARCHAR(20) NOT NULL,
      download_url   TEXT NOT NULL DEFAULT '',
      message        TEXT NOT NULL DEFAULT 'Tersedia versi terbaru!',
      updated_at     TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ Table app_version created (or already exists)');

  // Seed only if empty
  const rows = await sql`SELECT id FROM app_version LIMIT 1`;
  if (rows.length === 0) {
    await sql`
      INSERT INTO app_version (force_update, latest_version, min_version, download_url, message)
      VALUES (false, '4.1', '4.1', '', 'Aplikasi sudah versi terbaru')
    `;
    console.log('✓ Initial row seeded into app_version');
  } else {
    console.log('  Seed skipped — table already has data');
  }
}

main().catch(console.error);
