import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';

function addDuration(duration: string): Date | null {
  const now = new Date();
  if (duration === '3d') return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (duration === '7d') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (duration === '30d') return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (duration === 'permanent') return null; // null = no expiry
  return null;
}

// POST /api/redeem
export const POST: APIRoute = async ({ request }) => {
  let body: { code?: string; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Body tidak valid', vipUntil: null }), { status: 400 });
  }

  const code = String(body.code ?? '').trim().toUpperCase();
  const deviceId = String(body.deviceId ?? '').trim();

  if (!code || !deviceId)
    return new Response(JSON.stringify({ success: false, message: 'code dan deviceId wajib diisi', vipUntil: null }), { status: 400 });

  if (deviceId.length > 150)
    return new Response(JSON.stringify({ success: false, message: 'deviceId terlalu panjang', vipUntil: null }), { status: 400 });

  try {
    // Fetch code record
    const rows = await sql`
      SELECT code, duration, used FROM redeem_codes WHERE code = ${code}
    `;

    if (rows.length === 0)
      return new Response(JSON.stringify({ success: false, message: 'Kode tidak ditemukan', vipUntil: null }), { status: 404 });

    const record = rows[0];
    if (record.used)
      return new Response(JSON.stringify({ success: false, message: 'Kode sudah pernah digunakan', vipUntil: null }), { status: 409 });

    // Mark code as used
    const usedAt = new Date();
    await sql`
      UPDATE redeem_codes
      SET used = true, used_by = ${deviceId}, used_at = ${usedAt}
      WHERE code = ${code}
    `;

    // Compute vip_until
    const vipUntil = addDuration(record.duration);
    const tier = record.duration === 'permanent' ? 'vip_permanent' : 'vip';

    // Upsert device_vip
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
        success: true,
        message: 'Kode berhasil diredeem',
        vipUntil: vipUntil ? vipUntil.toISOString() : null,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ success: false, message: 'Terjadi kesalahan server', vipUntil: null }), { status: 500 });
  }
};
