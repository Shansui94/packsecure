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

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const order = 'DO-Yashin-260512-001';
        const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
        
        const res = await client.query(`
            SELECT txn_id, timestamp, event_type, sku, change_qty, loc_id, notes
            FROM public.stock_ledger_v2
            WHERE ref_doc = $1 AND sku = $2
            ORDER BY timestamp ASC
        `, [order, sku]);

        console.table(res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
