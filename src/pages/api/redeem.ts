import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import { rateLimit, getClientIp } from '../../lib/rateLimit';

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
  // Rate limit: max 10 attempts per IP per 5 minutes to prevent brute-forcing
  const ip = getClientIp(request);
  if (!rateLimit(`redeem:${ip}`, 10, 5 * 60 * 1000)) {
    return new Response(
      JSON.stringify({ message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 5 menit.' }),
      { status: 429, headers: { ...JSON_HEADERS, 'Retry-After': '300' } }
    );
  }

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

  // Validate format and length to prevent injections / DoS
  if (!/^[A-Z0-9_-]{6,50}$/.test(code)) {
    return new Response(JSON.stringify({ message: 'Format kode tidak valid' }), { status: 400, headers: JSON_HEADERS });
  }

  if (deviceId.length < 6 || deviceId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
    return new Response(JSON.stringify({ message: 'Format deviceId tidak valid' }), { status: 400, headers: JSON_HEADERS });
  }

  try {
    // Atomic update: only succeeds if the code exists AND used is false (CWE-362 Race Condition fix)
    const updated = (await sql`
      UPDATE redeem_codes
      SET used = true, used_by = ${deviceId}, used_at = NOW()
      WHERE code = ${code} AND used = false
      RETURNING duration
    `) as any[];

    if (updated.length === 0) {
      // Check if code was already used or doesn't exist
      const check = await sql`
        SELECT used FROM redeem_codes WHERE code = ${code} LIMIT 1
      `;
      if (check.length > 0 && check[0].used) {
        return new Response(JSON.stringify({ message: 'Kode sudah digunakan' }), { status: 400, headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ message: 'Kode tidak valid' }), { status: 400, headers: JSON_HEADERS });
    }

    const duration = updated[0].duration;

    // Compute vip_until and tier (vip1 = timed, vip2 = permanent)
    const vipUntil = computeVipUntil(duration);
    const tier = duration === 'permanent' ? 'vip2' : 'vip1';

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
