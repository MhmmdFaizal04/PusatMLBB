import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

// GET /api/device/[deviceId]
export const GET: APIRoute = async ({ params }) => {
  const deviceId = String(params.deviceId ?? '').trim();

  if (!deviceId)
    return new Response(JSON.stringify({ error: 'deviceId wajib diisi' }), { status: 400 });

  try {
    const rows = await sql`
      SELECT device_id, tier, vip_until FROM device_vip WHERE device_id = ${deviceId}
    `;

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ deviceId, tier: 'free', vipUntil: null, isVip: false }),
        { status: 200 }
      );
    }

    const { tier, vip_until } = rows[0];

    // Determine active VIP: permanent (null expiry) or not yet expired
    const isVip =
      tier === 'vip_permanent' ||
      (vip_until !== null && new Date(vip_until) > new Date());

    return new Response(
      JSON.stringify({
        deviceId,
        tier: isVip ? tier : 'free',
        vipUntil: vip_until ? new Date(vip_until).toISOString() : null,
        isVip,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), { status: 500 });
  }
};
