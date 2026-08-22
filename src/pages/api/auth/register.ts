import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { hashPassword, signJWT } from '../../../lib/auth';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Rate limit: max 5 registrasi per IP per jam
  const ip = getClientIp(request);
  if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return new Response(JSON.stringify({ error: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 1 jam.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
    });
  }
  try {
    const body = await request.json();
    const { email, username, password } = body as {
      email: string;
      username: string;
      password: string;
    };

    // Validation
    if (!email || !username || !password) {
      return new Response(JSON.stringify({ error: 'Semua field wajib diisi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Format email tidak valid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return new Response(
        JSON.stringify({ error: 'Username 3-30 karakter, hanya huruf/angka/underscore' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password minimal 8 karakter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check duplicate
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()} OR username = ${username.toLowerCase()}
    `;
    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: 'Email atau username sudah digunakan' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const passwordHash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (email, username, password_hash, role)
      VALUES (${email.toLowerCase()}, ${username.toLowerCase()}, ${passwordHash}, 'customer')
      RETURNING id, email, username, role
    `;
    const user = rows[0];

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

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
