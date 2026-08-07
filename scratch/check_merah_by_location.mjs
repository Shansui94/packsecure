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
            SELECT loc_id, SUM(change_qty) as balance, COUNT(*) as txn_count
            FROM public.stock_ledger_v2
            WHERE sku = $1
            GROUP BY loc_id
        `, [sku]);

        console.table(res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
