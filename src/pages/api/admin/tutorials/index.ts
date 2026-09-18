import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import {
  ensureTutorialTable,
  parseYouTubeId,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from '../../../../lib/tutorials';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// GET /api/admin/tutorials — list all tutorial videos
export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  try {
    await ensureTutorialTable();
    const rows = await sql`
      SELECT id, title, description, youtube_id, sort_order, is_active, created_at, updated_at
      FROM tutorial_videos
      ORDER BY sort_order ASC, created_at ASC
    `;
    return json(rows);
  } catch (err) {
    console.error('[admin/tutorials GET]', err);
    return json({ error: 'Gagal mengambil daftar video' }, 500);
  }
};

// POST /api/admin/tutorials — create a tutorial video
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body tidak valid' }, 400);
  }

  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const youtubeId = parseYouTubeId(String(body.youtube_url ?? ''));

  if (!title) return json({ error: 'Judul video wajib diisi' }, 400);
  if (title.length > MAX_TITLE_LENGTH)
    return json({ error: `Judul maksimal ${MAX_TITLE_LENGTH} karakter` }, 400);
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return json({ error: `Deskripsi maksimal ${MAX_DESCRIPTION_LENGTH} karakter` }, 400);
  if (!youtubeId)
    return json({ error: 'Link YouTube tidak valid. Contoh: https://youtu.be/xxxxxxxxxxx' }, 400);

  const isActive = body.is_active === undefined ? true : Boolean(body.is_active);
  const sortOrderRaw = Number(body.sort_order);
  const hasSortOrder = Number.isFinite(sortOrderRaw);

  try {
    await ensureTutorialTable();

    // Default to the end of the list when no explicit order is given
    let sortOrder = hasSortOrder ? Math.trunc(sortOrderRaw) : 0;
    if (!hasSortOrder) {
      const maxRows = await sql`
        SELECT COALESCE(MAX(sort_order), 0)::int AS max_order FROM tutorial_videos
      `;
      sortOrder = (maxRows[0]?.max_order ?? 0) + 1;
    }
    sortOrder = Math.min(Math.max(sortOrder, 0), 9999);

    const rows = await sql`
      INSERT INTO tutorial_videos (title, description, youtube_id, sort_order, is_active)
      VALUES (${title}, ${description || null}, ${youtubeId}, ${sortOrder}, ${isActive})
      RETURNING id, title, description, youtube_id, sort_order, is_active
    `;
    return json({ ok: true, video: rows[0] }, 201);
  } catch (err) {
    console.error('[admin/tutorials POST]', err);
    return json({ error: 'Gagal menyimpan video' }, 500);
  }
};
