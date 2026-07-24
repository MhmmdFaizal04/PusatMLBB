/**
 * Run once: adds cheat_duration to products, creates order_keys table,
 * and seeds "Cheat App" category.
 * Usage: npx tsx scripts/migrate-cheat-app.ts
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
  // 1. Add cheat_duration column to products if not exists
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS cheat_duration VARCHAR(20) DEFAULT NULL
  `;
  console.log('✓ Column cheat_duration added to products (or already exists)');

  // 2. Create order_keys table
  await sql`
    CREATE TABLE IF NOT EXISTS order_keys (
      id           SERIAL PRIMARY KEY,
      order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      code         VARCHAR(20) NOT NULL,
      duration     VARCHAR(20) NOT NULL,
      product_name VARCHAR(255),
      generated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ Table order_keys created (or already exists)');

  // 3. Seed "Cheat App" category if not exists
  const existing = await sql`SELECT id FROM categories WHERE slug = 'cheat-app' LIMIT 1`;
  if (existing.length === 0) {
    await sql`INSERT INTO categories (name, slug) VALUES ('Cheat App', 'cheat-app')`;
    console.log('✓ Category "Cheat App" seeded');
  } else {
    console.log('  Category "Cheat App" already exists (skipped)');
  }
}

main().catch(console.error);
