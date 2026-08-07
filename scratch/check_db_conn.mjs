import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;

const envText = fs.readFileSync('.env', 'utf-8');
const matches = envText.match(/(DATABASE_URL|POSTGRES_URL|SUPABASE_DB_URL)=(.*)/g);
console.log('Matches:', matches);

let dbUrl = '';
for (const line of envText.split('\n')) {
  if (line.startsWith('DATABASE_URL=') || line.startsWith('POSTGRES_URL=') || line.startsWith('SUPABASE_DB_URL=')) {
    dbUrl = line.split('=')[1].trim();
  }
}

if (!dbUrl) {
  // Let's check if there is standard Supabase db password or url constructed
  const projectRef = envText.match(/VITE_SUPABASE_URL=https:\/\/(.*)\.supabase\.co/)?.[1];
  console.log('Project Ref:', projectRef);
}

if (dbUrl) {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Postgres!');
    await client.query(`
      ALTER TABLE machine_rates ADD COLUMN IF NOT EXISTS night_rate NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE machine_rates ADD COLUMN IF NOT EXISTS day_rate NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE sys_users_v2 ADD COLUMN IF NOT EXISTS factory_login_mode TEXT DEFAULT 'mode_1';
    `);
    console.log('Successfully added columns via Postgres!');
    await client.end();
  } catch (err) {
    console.error('Postgres error:', err.message);
  }
} else {
  console.log('No direct DB URL in .env');
}
