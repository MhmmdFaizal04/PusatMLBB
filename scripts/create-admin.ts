/**
 * Run once to create the first admin account.
 * Usage: npx tsx scripts/create-admin.ts
 * Requires DATABASE_URL in .env
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

async function main() {
  const email = 'admin@pusatmlbb.com';
  const username = 'admin';
  const password = 'Admin@PusatMLBB!'; // Change immediately after first login

  const hash = await bcrypt.hash(password, 12);
  const id = randomUUID();

  await sql`
    INSERT INTO users (id, email, username, password_hash, role)
    VALUES (${id}, ${email}, ${username}, ${hash}, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;

  console.log('Admin created:');
  console.log('  Email:', email);
  console.log('  Username:', username);
  console.log('  Password:', password);
  console.log('  CHANGE PASSWORD AFTER FIRST LOGIN!');
}

main().catch(console.error);
