import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import 'dotenv/config';

// Use unpooled URL for migrations (pooler doesn't support DDL well)
const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!;
const sql = neon(dbUrl);
const schema = readFileSync('./src/db/schema.sql', 'utf8');

// Split on semicolons, strip leading comments from each statement
const statements = schema
  .split(';')
  .map((s) => {
    // Remove single-line comment lines at the start
    return s
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim();
  })
  .filter((s) => s.length > 0);

console.log(`Running ${statements.length} SQL statements...\n`);

for (const stmt of statements) {
  try {
    await sql.query(stmt);
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
    console.log(`✓ ${preview}`);
  } catch (e: any) {
    const msg: string = e.message || '';
    // Skip "already exists" errors safely
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate key') ||
      msg.includes('relation') && msg.includes('already')
    ) {
      console.log(`~ SKIP (already exists): ${stmt.slice(0, 60)}`);
    } else {
      console.error(`✗ ERROR: ${msg}`);
      console.error(`  Statement: ${stmt.slice(0, 80)}`);
    }
  }
}

console.log('\nDone! Database schema applied.');
