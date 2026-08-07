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
const auditTime = '2026-06-16 17:18:00';

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const res = await client.query(`
            SELECT event_type, COUNT(*) as tx_count, SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND timestamp >= $2
            GROUP BY event_type
        `, [sku, auditTime]);

        console.log(`=== Transactions for MERAH since ${auditTime} ===`);
        console.table(res.rows);

        // Also fetch the top 20 largest transactions in this period
        const largeRes = await client.query(`
            SELECT txn_id, timestamp, event_type, change_qty, loc_id, notes, ref_doc
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND timestamp >= $2
            ORDER BY ABS(change_qty) DESC
            LIMIT 20
        `, [sku, auditTime]);

        console.log("\n=== Top 20 largest transactions in this period ===");
        console.table(largeRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
