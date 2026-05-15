import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const rows = await sql`
      SELECT bypass_link, tutorial_video_url FROM qris_settings WHERE id = 1
    `;
    return new Response(JSON.stringify(rows[0] ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil pengaturan' }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const body = await request.json();
    const bypassLink: string = (body.bypass_link ?? '').trim();
    const tutorialUrl: string = (body.tutorial_video_url ?? '').trim();

    // Validate URLs if provided
    if (bypassLink && !bypassLink.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Link bypass harus URL valid (http/https)' }), { status: 400 });
    }
    if (tutorialUrl && !tutorialUrl.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Link tutorial harus URL valid (http/https)' }), { status: 400 });
    }

    await sql`
      UPDATE qris_settings
      SET bypass_link = ${bypassLink || null},
          tutorial_video_url = ${tutorialUrl || null},
          updated_at = NOW()
      WHERE id = 1
    `;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal menyimpan pengaturan' }), { status: 500 });
  }
};
