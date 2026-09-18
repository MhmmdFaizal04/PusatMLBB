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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/tutorials/[id] — update fields / toggle active
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (locals.user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const id = params.id ?? '';
  if (!UUID_RE.test(id)) return json({ error: 'ID tidak valid' }, 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body tidak valid' }, 400);
  }

  // Resolve only the fields that were actually sent
  let title: string | undefined;
  if (body.title !== undefined) {
    title = String(body.title).trim();
    if (!title) return json({ error: 'Judul video wajib diisi' }, 400);
    if (title.length > MAX_TITLE_LENGTH)
      return json({ error: `Judul maksimal ${MAX_TITLE_LENGTH} karakter` }, 400);
  }

  let description: string | null | undefined;
  if (body.description !== undefined) {
    const value = String(body.description).trim();
    if (value.length > MAX_DESCRIPTION_LENGTH)
      return json({ error: `Deskripsi maksimal ${MAX_DESCRIPTION_LENGTH} karakter` }, 400);
    description = value || null;
  }

  let youtubeId: string | undefined;
  if (body.youtube_url !== undefined) {
    const parsed = parseYouTubeId(String(body.youtube_url));
    if (!parsed)
      return json({ error: 'Link YouTube tidak valid. Contoh: https://youtu.be/xxxxxxxxxxx' }, 400);
    youtubeId = parsed;
  }

  let sortOrder: number | undefined;
  if (body.sort_order !== undefined) {
    const value = Number(body.sort_order);
    if (!Number.isFinite(value)) return json({ error: 'Urutan harus berupa angka' }, 400);
    sortOrder = Math.min(Math.max(Math.trunc(value), 0), 9999);
  }

  let isActive: boolean | undefined;
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean')
      return json({ error: 'Status aktif harus berupa boolean' }, 400);
    isActive = body.is_active;
  }

  if (
    title === undefined &&
    description === undefined &&
    youtubeId === undefined &&
    sortOrder === undefined &&
    isActive === undefined
  ) {
    return json({ error: 'Tidak ada data yang diubah' }, 400);
  }

  try {
    await ensureTutorialTable();
    const rows = await sql`
      UPDATE tutorial_videos SET
        title       = COALESCE(${title ?? null}, title),
        description = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE description END,
        youtube_id  = COALESCE(${youtubeId ?? null}, youtube_id),
        sort_order  = COALESCE(${sortOrder ?? null}, sort_order),
        is_active   = COALESCE(${isActive ?? null}, is_active),
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING id, title, description, youtube_id, sort_order, is_active
    `;
    if (rows.length === 0) return json({ error: 'Video tidak ditemukan' }, 404);
    return json({ ok: true, video: rows[0] });
  } catch (err) {
    console.error('[admin/tutorials PATCH]', err);
    return json({ error: 'Gagal memperbarui video' }, 500);
  }
};

// DELETE /api/admin/tutorials/[id]
export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const id = params.id ?? '';
  if (!UUID_RE.test(id)) return json({ error: 'ID tidak valid' }, 400);

  try {
    await ensureTutorialTable();
    const rows = await sql`DELETE FROM tutorial_videos WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return json({ error: 'Video tidak ditemukan' }, 404);
    return json({ ok: true });
  } catch (err) {
    console.error('[admin/tutorials DELETE]', err);
    return json({ error: 'Gagal menghapus video' }, 500);
  }
};
