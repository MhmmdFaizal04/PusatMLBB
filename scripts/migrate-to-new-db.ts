import { Client } from 'pg';

const OLD_URL =
  'postgresql://neondb_owner:npg_zjC6gPK0YViH@ep-bitter-sunset-aqi1xl19.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

const NEW_URL =
  'postgresql://neondb_owner:npg_gOG2H9jdKLJu@ep-young-surf-avvvfygb.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function createSchema(db: Client) {
  log('Creating schema...');
  await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await db.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), email VARCHAR(255) UNIQUE NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'customer', is_deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, name VARCHAR(255) NOT NULL, description TEXT, price INTEGER NOT NULL, stock INTEGER NOT NULL DEFAULT 0, is_available BOOLEAN NOT NULL DEFAULT TRUE, image_url TEXT, image_public_id TEXT, download_link TEXT, cheat_duration VARCHAR(20) DEFAULT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS cart_items (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL DEFAULT 1, cheat_duration VARCHAR(20) DEFAULT NULL, UNIQUE(user_id, product_id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS vouchers (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), code VARCHAR(50) UNIQUE NOT NULL, discount_type VARCHAR(20) NOT NULL, discount_value INTEGER NOT NULL, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, applies_to VARCHAR(50), expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, total_amount INTEGER NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending_approval', proof_image_url TEXT, proof_public_id TEXT, wa_reminded_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL, discount_amount INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id) ON DELETE SET NULL, quantity INTEGER NOT NULL, price_at_purchase INTEGER NOT NULL, product_name VARCHAR(255) NOT NULL, cheat_duration VARCHAR(20) DEFAULT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS qris_settings (id INTEGER PRIMARY KEY DEFAULT 1, image_url TEXT, public_id TEXT, bypass_link TEXT, tutorial_video_url TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS visitor_logs (id BIGSERIAL PRIMARY KEY, ip_hash VARCHAR(16), page VARCHAR(500), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS voucher_products (voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY (voucher_id, product_id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS redeem_codes (code VARCHAR(20) PRIMARY KEY, duration VARCHAR(20) NOT NULL, used BOOLEAN NOT NULL DEFAULT FALSE, used_by VARCHAR(150), used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS device_vip (device_id VARCHAR(150) PRIMARY KEY, vip_until TIMESTAMPTZ, tier VARCHAR(20) NOT NULL DEFAULT 'free', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS order_keys (id SERIAL PRIMARY KEY, order_id UUID REFERENCES orders(id) ON DELETE CASCADE, code VARCHAR(20) NOT NULL, duration VARCHAR(20), product_name VARCHAR(255), generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS app_version (id SERIAL PRIMARY KEY, force_update BOOLEAN NOT NULL DEFAULT FALSE, latest_version VARCHAR(20) NOT NULL DEFAULT '1.0', min_version VARCHAR(20) NOT NULL DEFAULT '1.0', download_url TEXT, message TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS cheat_app_prices (product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE, duration VARCHAR(20) NOT NULL, price INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (product_id, duration))`);
  log('Schema ready');
}

async function copyTable(oldDb: Client, newDb: Client, tableName: string, orderBy: string) {
  const countRes = await newDb.query(`SELECT COUNT(*) FROM ${tableName}`);
  const existing = parseInt(countRes.rows[0].count, 10);
  if (existing > 0) {
    log(`  ${tableName}: ${existing} rows already exist - SKIPPED`);
    return;
  }

  const result = await oldDb.query(`SELECT * FROM "${tableName}" ORDER BY ${orderBy}`);
  const rows = result.rows;
  if (!rows.length) { log(`  ${tableName}: 0 rows`); return; }

  log(`  ${tableName}: ${rows.length} rows - copying...`);
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  let n = 0;
  for (const row of rows) {
    const vals = cols.map((c) => row[c]);
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    await newDb.query(`INSERT INTO "${tableName}" (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
    n++;
  }
  log(`  ${tableName}: ${n} rows inserted`);
}

async function main() {
  const oldDb = new Client({ connectionString: OLD_URL, ssl: { rejectUnauthorized: false } });
  const newDb = new Client({ connectionString: NEW_URL, ssl: { rejectUnauthorized: false } });

  log('=== DB Migration START ===');
  await oldDb.connect(); log('Connected OLD DB');
  await newDb.connect(); log('Connected NEW DB');

  try {
    await createSchema(newDb);
    log('\nCopying data...');
    await copyTable(oldDb, newDb, 'users', 'created_at');
    await copyTable(oldDb, newDb, 'categories', 'id');
    await copyTable(oldDb, newDb, 'qris_settings', 'id');
    await copyTable(oldDb, newDb, 'vouchers', 'created_at');
    await copyTable(oldDb, newDb, 'products', 'created_at');
    await copyTable(oldDb, newDb, 'cheat_app_prices', 'product_id');
    await copyTable(oldDb, newDb, 'voucher_products', 'voucher_id');
    await copyTable(oldDb, newDb, 'cart_items', 'id');
    await copyTable(oldDb, newDb, 'orders', 'created_at');
    await copyTable(oldDb, newDb, 'order_items', 'id');
    await copyTable(oldDb, newDb, 'order_keys', 'generated_at');
    await copyTable(oldDb, newDb, 'redeem_codes', 'created_at');
    await copyTable(oldDb, newDb, 'device_vip', 'updated_at');
    await copyTable(oldDb, newDb, 'app_version', 'id');
    log('\n=== MIGRATION COMPLETE ===');
    log('Sekarang update DATABASE_URL di Vercel lalu redeploy.');
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });