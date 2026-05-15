import { neon } from '@neondatabase/serverless';

// Use pooler URL (channel_binding stripped — not supported by HTTP driver)
const rawUrl: string = import.meta.env.DATABASE_URL;
const dbUrl = rawUrl.replace('channel_binding=require&', '').replace('&channel_binding=require', '').replace('?channel_binding=require', '');

const sql = neon(dbUrl);

export { sql };
