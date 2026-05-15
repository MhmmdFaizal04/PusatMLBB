/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      userId: string;
      role: 'customer' | 'admin';
      username: string;
      email: string;
    };
  }
}

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly JWT_SECRET: string;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly PUBLIC_WA_ADMIN: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
