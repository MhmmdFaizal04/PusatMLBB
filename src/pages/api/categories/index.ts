import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const rows = await sql`SELECT id, name, slug FROM categories ORDER BY name`;
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil kategori' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const { name, slug } = await request.json();
    if (!name || !slug) {
      return new Response(JSON.stringify({ error: 'Nama dan slug wajib diisi' }), { status: 400 });
    }
    const rows = await sql`
      INSERT INTO categories (name, slug) VALUES (${name}, ${slug})
      ON CONFLICT (slug) DO NOTHING
      RETURNING *
    `;
    return new Response(JSON.stringify(rows[0] ?? { error: 'Slug sudah ada' }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal membuat kategori' }), { status: 500 });
  }
};
