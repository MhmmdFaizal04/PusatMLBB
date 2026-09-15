import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { comparePassword, hashPassword } from '../../../lib/auth';
import { rateLimit } from '../../../lib/rateLimit';

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // Rate limit: max 5 password change attempts per 15 minutes per user
  if (!rateLimit(`pwd:${locals.user.userId}`, 5, 15 * 60 * 1000)) {
    return new Response(
      JSON.stringify({ error: 'Terlalu banyak percobaan ganti password. Coba lagi dalam 15 menit.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '900' } }
    );
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Password lama dan baru wajib diisi' }),
        { status: 400 },
      );
    }
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password baru minimal 8 karakter' }),
        { status: 400 },
      );
    }

    const rows = await sql`SELECT password_hash FROM users WHERE id = ${locals.user.userId}`;
    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'User tidak ditemukan' }), { status: 404 });
    }

    const valid = await comparePassword(currentPassword, rows[0].password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Password lama tidak sesuai' }), { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${locals.user.userId}`;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengubah password' }), { status: 500 });
  }
};
