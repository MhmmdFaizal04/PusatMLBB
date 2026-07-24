import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

// GET /api/admin/app-version — fetch current settings (admin only)
export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  try {
    const rows = await sql`
      SELECT id, force_update, latest_version, min_version, download_url, message, updated_at
      FROM app_version
      ORDER BY id DESC
      LIMIT 1
    `;
    return new Response(JSON.stringify(rows[0] ?? null), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil data' }), { status: 500 });
  }
};

// POST /api/admin/app-version — update settings (admin only)
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin')
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  let body: {
    forceUpdate?: boolean;
    latestVersion?: string;
    minVersion?: string;
    downloadUrl?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body tidak valid' }), { status: 400 });
  }

  const forceUpdate = Boolean(body.forceUpdate);
  const latestVersion = String(body.latestVersion ?? '').trim();
  const minVersion = String(body.minVersion ?? '').trim();
  const downloadUrl = String(body.downloadUrl ?? '').trim();
  const message = String(body.message ?? '').trim();

  // Validations
  if (!latestVersion)
    return new Response(JSON.stringify({ error: 'Versi terbaru wajib diisi' }), { status: 400 });
  if (!minVersion)
    return new Response(JSON.stringify({ error: 'Versi minimum wajib diisi' }), { status: 400 });
  if (!message)
    return new Response(JSON.stringify({ error: 'Pesan wajib diisi' }), { status: 400 });
  if (forceUpdate && !downloadUrl)
    return new Response(
      JSON.stringify({ error: 'Link download APK wajib diisi saat Force Update aktif' }),
      { status: 400 }
    );
  if (downloadUrl && !downloadUrl.startsWith('https://'))
    return new Response(
      JSON.stringify({ error: 'Link download harus menggunakan HTTPS' }),
      { status: 400 }
    );

  try {
    // Upsert: update row id=1 (single-row config), or insert if not exists
    const existing = await sql`SELECT id FROM app_version ORDER BY id ASC LIMIT 1`;

    let result: any[];
    if (existing.length > 0) {
      result = await sql`
        UPDATE app_version
        SET force_update   = ${forceUpdate},
            latest_version = ${latestVersion},
            min_version    = ${minVersion},
            download_url   = ${downloadUrl},
            message        = ${message},
            updated_at     = NOW()
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
    } else {
      result = await sql`
        INSERT INTO app_version (force_update, latest_version, min_version, download_url, message)
        VALUES (${forceUpdate}, ${latestVersion}, ${minVersion}, ${downloadUrl}, ${message})
        RETURNING *
      `;
    }

    return new Response(JSON.stringify({ success: true, data: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal menyimpan pengaturan' }), { status: 500 });
  }
};
