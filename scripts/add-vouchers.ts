import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Creating vouchers table...');

  await sql`
    CREATE TABLE IF NOT EXISTS vouchers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(50) UNIQUE NOT NULL,
      discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
      discount_value INTEGER NOT NULL CHECK (discount_value > 0),
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      applies_to VARCHAR(10) NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'specific')),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS voucher_products (
      voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (voucher_id, product_id)
    )
  `;

  // Add voucher columns to orders table
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0`;

  await sql`CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_voucher_products_voucher ON voucher_products(voucher_id)`;

  console.log('Done! Vouchers system ready.');
}

migrate().catch(console.error);
