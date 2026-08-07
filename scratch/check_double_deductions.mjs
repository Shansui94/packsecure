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

        const orderNumbers = ['DO-yan-260610-001', 'DO-yan-260608-001', 'DO-Yashin-260609-001'];
        
        const res = await client.query(`
            SELECT txn_id, timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
            FROM public.stock_ledger_v2
            WHERE ref_doc = ANY($1::text[])
            ORDER BY ref_doc, timestamp ASC
        `, [orderNumbers]);

        console.table(res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
