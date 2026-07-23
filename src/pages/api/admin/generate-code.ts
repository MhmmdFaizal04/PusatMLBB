import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

const VALID_DURATIONS = ['3d', '7d', '30d', 'permanent'] as const;
type Duration = (typeof VALID_DURATIONS)[number];

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `ZALL-${part(4)}-${part(4)}`;
}

// POST /api/admin/generate-code
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  let body: { duration?: string; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body tidak valid' }), { status: 400 });
  }

  const { duration, quantity } = body;

  if (!duration || !VALID_DURATIONS.includes(duration as Duration))
    return new Response(JSON.stringify({ error: 'Durasi tidak valid. Gunakan: 3d, 7d, 30d, permanent' }), { status: 400 });

  const qty = Number(quantity);
  if (!qty || qty < 1 || qty > 50)
    return new Response(JSON.stringify({ error: 'Jumlah kode harus antara 1 sampai 50' }), { status: 400 });

  // Generate unique codes
  const codes: string[] = [];
  const attempts = qty * 5; // safety limit
  let tries = 0;

  while (codes.length < qty && tries < attempts) {
    tries++;
    const code = generateCode();
    if (!codes.includes(code)) codes.push(code);
  }

  if (codes.length < qty)
    return new Response(JSON.stringify({ error: 'Gagal generate cukup kode unik' }), { status: 500 });

  try {
    // Bulk insert — use a loop to stay compatible with neon HTTP driver
    for (const code of codes) {
      await sql`
        INSERT INTO redeem_codes (code, duration)
        VALUES (${code}, ${duration})
        ON CONFLICT (code) DO NOTHING
      `;
    }
    return new Response(JSON.stringify({ codes }), { status: 201 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal menyimpan kode ke database' }), { status: 500 });
  }
};
