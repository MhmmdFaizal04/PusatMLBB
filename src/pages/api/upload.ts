import type { APIRoute } from 'astro';
import { uploadToCloudinary } from '../../lib/cloudinary';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder')?.toString() || 'uploads';

    if (!file || file.size === 0) {
      return new Response(JSON.stringify({ error: 'File tidak ditemukan' }), { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP' }),
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'Ukuran file maksimal 5MB' }), { status: 400 });
    }

    // Only allow safe folder names
    const safeFolders = ['proofs', 'products', 'qris'];
    const safeFolder = safeFolders.includes(folder) ? folder : 'uploads';

    const buffer = Buffer.from(await file.arrayBuffer());
    const { url, publicId } = await uploadToCloudinary(buffer, safeFolder);

    return new Response(JSON.stringify({ url, publicId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: 'Gagal mengupload file' }), { status: 500 });
  }
};
