import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { comparePassword, signJWT } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { identifier, password } = body as { identifier: string; password: string };

    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: 'Email/username dan password wajib diisi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lower = identifier.toLowerCase();
    const rows = await sql`
      SELECT id, email, username, password_hash, role, is_deleted
      FROM users
      WHERE (email = ${lower} OR username = ${lower}) AND is_deleted = FALSE
      LIMIT 1
    `;

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Email/username atau password salah' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = rows[0];
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Email/username atau password salah' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await signJWT({
      userId: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
    });

    cookies.set('token', token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return new Response(JSON.stringify({ ok: true, role: user.role }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
