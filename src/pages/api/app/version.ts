import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

// GET /api/app/version — public endpoint for Android app
export const GET: APIRoute = async () => {
  try {
    const rows = await sql`
      SELECT force_update, latest_version, min_version, download_url, message
      FROM app_version
      ORDER BY id DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          forceUpdate: false,
          latestVersion: '1.0',
          minVersion: '1.0',
          downloadUrl: '',
          message: 'Aplikasi sudah versi terbaru',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const row = rows[0];
    return new Response(
      JSON.stringify({
        forceUpdate: row.force_update,
        latestVersion: row.latest_version,
        minVersion: row.min_version,
        downloadUrl: row.download_url ?? '',
        message: row.message ?? '',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
