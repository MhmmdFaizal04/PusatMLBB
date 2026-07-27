import { defineMiddleware } from 'astro:middleware';
import { verifyJWT } from './lib/auth';
import { sql } from './lib/db';
import { createHash } from 'node:crypto';

const CUSTOMER_ROUTES = ['/cart', '/checkout', '/orders', '/files', '/profile'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Verify JWT from cookie
  const token = cookies.get('token')?.value;
  if (token) {
    const user = await verifyJWT(token);
    if (user) {
      context.locals.user = user;
    }
  }

  const user = context.locals.user;

  // Log page visits (HTML pages only, not API/assets)
  if (
    request.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_') &&
    !pathname.includes('.')
  ) {
    try {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
      sql`INSERT INTO visitor_logs (ip_hash, page) VALUES (${ipHash}, ${pathname})`.catch(
        () => {},
      );
    } catch {
      // ignore
    }
  }

  // Guard: admin routes
  if (pathname.startsWith('/admin')) {
    if (!user || user.role !== 'admin') {
      return redirect('/login?redirect=' + encodeURIComponent(pathname));
    }
  }

  // Guard: API admin routes
  if (pathname.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Guard: customer-only pages
  const isCustomerRoute = CUSTOMER_ROUTES.some((r) => pathname.startsWith(r));
  if (isCustomerRoute && !user) {
    return redirect('/login?redirect=' + encodeURIComponent(pathname));
  }

  // Guard: auth-required API routes
  const authApiPrefixes = ['/api/cart', '/api/orders', '/api/upload'];
  if (authApiPrefixes.some((p) => pathname.startsWith(p)) && !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return next();
});
