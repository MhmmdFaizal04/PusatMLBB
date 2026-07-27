import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function computeVipUntil(duration: string): Date | null {
  const now = new Date();
  if (duration === '3d') return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (duration === '7d') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (duration === '30d') return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return null; // permanent → null
}

// POST /api/redeem
export const POST: APIRoute = async ({ request }) => {
  let body: { code?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Body tidak valid' }), { status: 400, headers: JSON_HEADERS });
  }

  const code = String(body.code ?? '').trim().toUpperCase();
  const deviceId = String(body.deviceId ?? '').trim();

  if (!code || !deviceId)
    return new Response(JSON.stringify({ message: 'code dan deviceId wajib diisi' }), { status: 400, headers: JSON_HEADERS });

  if (deviceId.length > 150)
    return new Response(JSON.stringify({ message: 'deviceId terlalu panjang' }), { status: 400, headers: JSON_HEADERS });

  try {
    // Fetch code record
    const rows = await sql`
      SELECT code, duration, used FROM redeem_codes WHERE code = ${code}
    `;

    if (rows.length === 0)
      return new Response(JSON.stringify({ message: 'Kode tidak valid' }), { status: 400, headers: JSON_HEADERS });

    const record = rows[0];
    if (record.used)
      return new Response(JSON.stringify({ message: 'Kode sudah digunakan' }), { status: 400, headers: JSON_HEADERS });

    // Mark code as used
    await sql`
      UPDATE redeem_codes
      SET used = true, used_by = ${deviceId}, used_at = NOW()
      WHERE code = ${code}
    `;

    // Compute vip_until and tier (vip1 = timed, vip2 = permanent)
    const vipUntil = computeVipUntil(record.duration);
    const tier = record.duration === 'permanent' ? 'vip2' : 'vip1';

    // Auto-create or update device_vip (never fails if device doesn't exist)
    await sql`
      INSERT INTO device_vip (device_id, vip_until, tier, updated_at)
      VALUES (${deviceId}, ${vipUntil}, ${tier}, NOW())
      ON CONFLICT (device_id) DO UPDATE
        SET vip_until = EXCLUDED.vip_until,
            tier = EXCLUDED.tier,
            updated_at = NOW()
    `;

    return new Response(
      JSON.stringify({
        deviceId,
        tier,
        isVip: true,
        vipUntil: vipUntil ? vipUntil.toISOString() : null,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: 'Terjadi kesalahan server' }), { status: 500, headers: JSON_HEADERS });
  }
};
