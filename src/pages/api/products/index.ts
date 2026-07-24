import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../lib/cloudinary';

export const GET: APIRoute = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = 12;
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT p.id, p.name, p.description, p.price, p.stock, p.is_available,
             p.image_url, p.created_at,
             c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_available = TRUE
        AND (${search} = '' OR p.name ILIKE ${'%' + search + '%'} OR p.description ILIKE ${'%' + search + '%'})
        AND (${category} = '' OR c.slug = ${category})
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_available = TRUE
        AND (${search} = '' OR p.name ILIKE ${'%' + search + '%'})
        AND (${category} = '' OR c.slug = ${category})
    `;

    return new Response(
      JSON.stringify({ products: rows, total: countRows[0]?.total ?? 0, page, limit }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengambil produk' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const formData = await request.formData();
    const name = formData.get('name')?.toString() ?? '';
    const description = formData.get('description')?.toString() ?? '';
    const price = parseInt(formData.get('price')?.toString() ?? '0');
    const stock = parseInt(formData.get('stock')?.toString() ?? '0');
    const categoryId = formData.get('category_id')?.toString() || null;
    const downloadLink = formData.get('download_link')?.toString() || null;
    const isAvailable = formData.get('is_available') === 'true';
    const cheatDuration = formData.get('cheat_duration')?.toString() || null;
    const imageFile = formData.get('image') as File | null;

    if (!name || price <= 0) {
      return new Response(JSON.stringify({ error: 'Nama dan harga wajib diisi' }), {
        status: 400,
      });
    }

    const VALID_DURATIONS = ['3d', '7d', '30d', 'permanent'];
    const validatedDuration = cheatDuration && VALID_DURATIONS.includes(cheatDuration) ? cheatDuration : null;

    let imageUrl: string | null = null;
    let imagePublicId: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const result = await uploadToCloudinary(buffer, 'products');
      imageUrl = result.url;
      imagePublicId = result.publicId;
    }

    const rows = await sql`
      INSERT INTO products (name, description, price, stock, category_id, download_link,
                            is_available, image_url, image_public_id, cheat_duration)
      VALUES (${name}, ${description}, ${price}, ${stock}, ${categoryId},
              ${downloadLink}, ${isAvailable}, ${imageUrl}, ${imagePublicId}, ${validatedDuration})
      RETURNING id
    `;

    return new Response(JSON.stringify({ ok: true, id: rows[0].id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal membuat produk' }), { status: 500 });
  }
};
