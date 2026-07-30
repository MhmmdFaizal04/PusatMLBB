import { neon, neonConfig } from '@neondatabase/serverless';

// Reuse HTTP connection within the same serverless invocation
neonConfig.fetchConnectionCache = true;

// Use pooler URL (channel_binding stripped — not supported by HTTP driver)
const rawUrl: string = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error('DATABASE_URL is not set. Create a .env file based on .env.example');
}
const dbUrl = rawUrl
  .replace('channel_binding=require&', '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require', '');

const sql = neon(dbUrl);

export { sql };
