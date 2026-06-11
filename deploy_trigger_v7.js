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
        console.log("Connected to PG successfully!");

        console.log("Reading robust_order_triggers_v7.sql...");
        const sql = fs.readFileSync('scripts/db_ops/robust_order_triggers_v7.sql', 'utf8');

        console.log("Deploying triggers to database...");
        await client.query(sql);
        console.log("Trigger deployment completed successfully!");

    } catch (e) {
        console.error("Deployment error:", e);
    } finally {
        await client.end();
    }
}

run();
