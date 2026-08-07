import pg from 'pg';
const { Client } = pg;
import * as dotenv from 'dotenv';
dotenv.config();

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const res = await client.query(`
            SELECT txn_id, timestamp, event_type, change_qty, loc_id, notes, ref_doc
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND timestamp >= '2026-04-08 00:00:00' AND timestamp <= '2026-04-23 23:59:59'
            ORDER BY timestamp ASC
        `, [sku]);

        console.table(res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
