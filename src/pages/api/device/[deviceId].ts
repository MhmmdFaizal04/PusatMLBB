import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Normalize stored tier to spec values: free | vip1 | vip2
function normalizeTier(raw: string): 'free' | 'vip1' | 'vip2' {
  if (raw === 'vip2' || raw === 'vip_permanent') return 'vip2';
  if (raw === 'vip1' || raw === 'vip') return 'vip1';
  return 'free';
}

// GET /api/device/[deviceId]
export const GET: APIRoute = async ({ params }) => {
  const deviceId = String(params.deviceId ?? '').trim();

  if (!deviceId)
    return new Response(JSON.stringify({ error: 'deviceId wajib diisi' }), { status: 400, headers: JSON_HEADERS });

  try {
    const rows = await sql`
      SELECT device_id, tier, vip_until FROM device_vip WHERE device_id = ${deviceId}
    `;

    if (rows.length === 0) {
      // AUTO-CREATE device with free tier — never return 401 for unknown device
      await sql`
        INSERT INTO device_vip (device_id, tier, vip_until, updated_at)
        VALUES (${deviceId}, 'free', NULL, NOW())
        ON CONFLICT (device_id) DO NOTHING
      `;
      return new Response(
        JSON.stringify({ deviceId, tier: 'free', isVip: false, vipUntil: null }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const { tier, vip_until } = rows[0];
    const normalizedTier = normalizeTier(tier);

    // isVip: vip2 (permanent) always active; vip1 only if not yet expired
    const isVip =
      normalizedTier === 'vip2' ||
      (normalizedTier === 'vip1' && vip_until !== null && new Date(vip_until) > new Date());

    return new Response(
      JSON.stringify({
        deviceId,
        tier: isVip ? normalizedTier : 'free',
        isVip,
        vipUntil: vip_until ? new Date(vip_until).toISOString() : null,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), { status: 500, headers: JSON_HEADERS });
  }
};
