import type { APIRoute } from 'astro';
import { sql } from '../lib/db';

export const GET: APIRoute = async () => {
  const site = import.meta.env.PUBLIC_SITE_URL || 'https://pusatmlbb.vercel.app';

  const products = await sql`SELECT id, updated_at FROM products WHERE is_available = TRUE`
    .catch(() => []);

  const staticPages: { url: string; priority: string; changefreq: string; lastmod?: string }[] = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/products', priority: '0.9', changefreq: 'daily' },
    { url: '/login', priority: '0.5', changefreq: 'monthly' },
    { url: '/register', priority: '0.5', changefreq: 'monthly' },
  ];

  const productPages = (products as any[]).map((p: any) => ({
    url: `/products/${p.id}`,
    priority: '0.8',
    changefreq: 'weekly',
    lastmod: new Date(p.updated_at).toISOString().split('T')[0],
  }));

  const allPages: { url: string; priority: string; changefreq: string; lastmod?: string }[] = [...staticPages, ...productPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${site}${p.url}</loc>
    ${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : `<lastmod>${new Date().toISOString().split('T')[0]}</lastmod>`}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
