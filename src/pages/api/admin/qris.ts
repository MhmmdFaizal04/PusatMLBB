import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../lib/cloudinary';

export const GET: APIRoute = async () => {
  try {
    const rows = await sql`SELECT image_url, public_id FROM qris_settings WHERE id = 1`;
    return new Response(JSON.stringify(rows[0] ?? { image_url: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil QRIS' }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: 'File QRIS wajib diupload' }), { status: 400 });
    }

    // Delete old QRIS
    const existing = await sql`SELECT public_id FROM qris_settings WHERE id = 1`;
    if (existing[0]?.public_id) {
      await deleteFromCloudinary(existing[0].public_id);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url, publicId } = await uploadToCloudinary(buffer, 'qris');

    await sql`
      UPDATE qris_settings SET image_url = ${url}, public_id = ${publicId}, updated_at = NOW()
      WHERE id = 1
    `;

    return new Response(JSON.stringify({ ok: true, url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengupload QRIS' }), { status: 500 });
  }
};
