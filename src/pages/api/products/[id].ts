import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../lib/cloudinary';

export const GET: APIRoute = async ({ params }) => {
  try {
    const rows = await sql`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${params.id!}
      LIMIT 1
    `;
    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'Produk tidak ditemukan' }), { status: 404 });
    }
    return new Response(JSON.stringify(rows[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Gagal mengambil produk' }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
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
    const cheatPricesRaw = formData.get('cheat_prices')?.toString() || null;
    const imageFile = formData.get('image') as File | null;

    // Get existing product
    const existing = await sql`SELECT image_public_id FROM products WHERE id = ${params.id!}`;
    if (!existing.length) {
      return new Response(JSON.stringify({ error: 'Produk tidak ditemukan' }), { status: 404 });
    }

    let imageUrl: string | null = null;
    let imagePublicId: string | null = existing[0].image_public_id;

    if (imageFile && imageFile.size > 0) {
      if (existing[0].image_public_id) {
        await deleteFromCloudinary(existing[0].image_public_id);
      }
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const result = await uploadToCloudinary(buffer, 'products');
      imageUrl = result.url;
      imagePublicId = result.publicId;
    }

    if (imageUrl) {
      await sql`
        UPDATE products
        SET name=${name}, description=${description}, price=${price}, stock=${stock},
            category_id=${categoryId}, download_link=${downloadLink},
            is_available=${isAvailable}, image_url=${imageUrl}, image_public_id=${imagePublicId},
            updated_at=NOW()
        WHERE id = ${params.id!}
      `;
    } else {
      await sql`
        UPDATE products
        SET name=${name}, description=${description}, price=${price}, stock=${stock},
            category_id=${categoryId}, download_link=${downloadLink},
            is_available=${isAvailable}, updated_at=NOW()
        WHERE id = ${params.id!}
      `;
    }

    // Save cheat app prices if provided
    if (cheatPricesRaw) {
      const VALID_DURATIONS = ['3d', '7d', '30d', 'permanent'];
      const prices: Record<string, number> = JSON.parse(cheatPricesRaw);
      for (const duration of VALID_DURATIONS) {
        const p = prices[duration] ?? 0;
        if (p > 0) {
          await sql`
            INSERT INTO cheat_app_prices (product_id, duration, price)
            VALUES (${params.id!}, ${duration}, ${p})
            ON CONFLICT (product_id, duration) DO UPDATE SET price = EXCLUDED.price
          `;
        } else {
          await sql`DELETE FROM cheat_app_prices WHERE product_id = ${params.id!} AND duration = ${duration}`;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal mengupdate produk' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (locals.user?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const rows = await sql`SELECT image_public_id FROM products WHERE id = ${params.id!}`;
    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'Produk tidak ditemukan' }), { status: 404 });
    }
    if (rows[0].image_public_id) {
      await deleteFromCloudinary(rows[0].image_public_id);
    }
    await sql`DELETE FROM products WHERE id = ${params.id!}`;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Gagal menghapus produk' }), { status: 500 });
  }
};
