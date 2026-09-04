import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres.vofnsskyqoxjswyemnhb:Neo1994son@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log("Connected to Supabase Postgres!");
        await client.query("ALTER TABLE IF EXISTS public.master_items_v2 ADD COLUMN IF NOT EXISTS photo_url TEXT;");
        console.log("Executed: ALTER TABLE public.master_items_v2 ADD COLUMN IF NOT EXISTS photo_url TEXT;");
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'master_items_v2' AND column_name = 'photo_url';");
        console.log("Verified column in master_items_v2:", res.rows);
        await client.end();
    } catch (e: any) {
        console.error("Migration error:", e.message);
    }
}

run();
