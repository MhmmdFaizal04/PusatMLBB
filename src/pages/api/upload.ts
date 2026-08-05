import type { APIRoute } from 'astro';
import { uploadToCloudinary } from '../../lib/cloudinary';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Verify actual file content via magic bytes — client-sent MIME type can be spoofed
function verifyImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return true;
  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
}

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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Verify actual file content — reject files that claim to be images but aren't
    if (!verifyImageMagicBytes(buffer)) {
      return new Response(
        JSON.stringify({ error: 'File bukan gambar yang valid' }),
        { status: 400 },
      );
    }

    // Only allow safe folder names
    const safeFolders = ['proofs', 'products', 'qris'];
    const safeFolder = safeFolders.includes(folder) ? folder : 'uploads';

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
