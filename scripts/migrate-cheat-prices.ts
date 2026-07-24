/**
 * Migration: cheat_app_prices table + cheat_duration columns on cart_items & order_items
 * Usage: npx tsx scripts/migrate-cheat-prices.ts
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
  // 1. Prices per duration for cheat app products
  await sql`
    CREATE TABLE IF NOT EXISTS cheat_app_prices (
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      duration   VARCHAR(20) NOT NULL,
      price      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, duration)
    )
  `;
  console.log('✓ Table cheat_app_prices created (or already exists)');

  // 2. Store chosen duration per cart item
  await sql`
    ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS cheat_duration VARCHAR(20) DEFAULT NULL
  `;
  console.log('✓ Column cheat_duration added to cart_items');

  // 3. Store chosen duration per order item (for key generation on approve)
  await sql`
    ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS cheat_duration VARCHAR(20) DEFAULT NULL
  `;
  console.log('✓ Column cheat_duration added to order_items');
}

main().catch(console.error);
