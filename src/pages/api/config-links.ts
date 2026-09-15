import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { rateLimit, getClientIp } from '../../lib/rateLimit';

const CONFIGS = [
  { key: 'drone', label: 'Drone' },
  { key: 'semi_fitur', label: 'Semi Fitur' },
  { key: 'full_fitur', label: 'Full Fitur' },
];

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS config_links (
      key VARCHAR(50) PRIMARY KEY,
      label VARCHAR(100) NOT NULL,
      url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Seed default rows if not exist
  for (const c of CONFIGS) {
    await sql`
      INSERT INTO config_links (key, label, url)
      VALUES (${c.key}, ${c.label}, NULL)
      ON CONFLICT (key) DO NOTHING
    `;
  }
  tableInitialized = true;
}

// GET /api/config-links — public, diakses aplikasi Android
export const GET: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  if (!rateLimit(`config-links:${ip}`, 120, 60 * 1000)) {
    return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan' }), { status: 429 });
  }

  try {
    await ensureTable();
    const rows = await sql`SELECT key, url FROM config_links ORDER BY key`;
    const result: Record<string, string | null> = {};
    for (const row of rows as { key: string; url: string | null }[]) {
      result[row.key] = row.url;
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[config-links GET]', err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil data' }), { status: 500 });
  }
};

// POST /api/config-links — admin only
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { key?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body tidak valid' }), { status: 400 });
  }

  const key = String(body.key ?? '').trim();
  const url = String(body.url ?? '').trim();

  const validKeys = CONFIGS.map((c) => c.key);
  if (!validKeys.includes(key)) {
    return new Response(JSON.stringify({ error: 'Key tidak valid' }), { status: 400 });
  }

  if (url && !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url)) {
    return new Response(JSON.stringify({ error: 'URL harus diawali http:// atau https:// dan valid' }), { status: 400 });
  }

  try {
    await ensureTable();
    await sql`
      UPDATE config_links
      SET url = ${url || null}, updated_at = NOW()
      WHERE key = ${key}
    `;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('[config-links POST]', err);
    return new Response(JSON.stringify({ error: 'Gagal menyimpan data' }), { status: 500 });
  }
};
