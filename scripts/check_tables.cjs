const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

async function queryPG() {
    // try direct postgres connection if VITE_DATABASE_URL exists, or try to get connection string
    const dbUrl = process.env.DATABASE_URL || 'postgres://postgres.vofnsskyqoxjswyemnhb:Neo1994son@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
    console.log("URL:", dbUrl.substring(0, 30) + '...');
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE';
        `);
        console.log("Tables:");
        res.rows.forEach(r => console.log(r.table_name));
        client.end();
    } catch (e) {
        console.error("PG Connection error", e);
    }
}

queryPG();
