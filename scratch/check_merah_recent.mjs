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
            SELECT event_type, COUNT(*) as tx_count, SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND timestamp >= '2026-04-24 00:00:00'
            GROUP BY event_type
        `, [sku]);

        console.table(res.rows);

        // Also fetch the current balance as of today
        const balRes = await client.query(`
            SELECT SUM(change_qty) as balance
            FROM public.stock_ledger_v2
            WHERE sku = $1
        `, [sku]);
        console.log(`Current total stock balance in ledger: ${balRes.rows[0].balance}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
