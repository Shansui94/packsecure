import pg from 'pg';

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const { Client } = pg;
const client = new Client(config);

async function run() {
    try {
        await client.connect();
        console.log("Connected to Supabase Pooler DB!");
        
        await client.query("ALTER TABLE public.master_items_v2 ADD COLUMN IF NOT EXISTS photo_url TEXT;");
        console.log("Added photo_url to master_items_v2!");

        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'master_items_v2' AND column_name = 'photo_url';");
        console.log("Verified master_items_v2 column:", res.rows);

        await client.end();
        console.log("Done!");
    } catch (e) {
        console.error("DB Error:", e);
        process.exit(1);
    }
}

run();
