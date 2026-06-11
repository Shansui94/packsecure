import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        const res = await client.query(`
            SELECT pg_get_viewdef('v2_inventory_view', true) AS view_def;
        `);
        console.log("View Definition:");
        console.log(res.rows[0].view_def);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
