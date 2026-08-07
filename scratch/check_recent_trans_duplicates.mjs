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

        // Find ref_docs with multiple Transfer Out records for this SKU
        const res = await client.query(`
            SELECT ref_doc, COUNT(*) as tx_count, SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND event_type = 'Transfer Out' AND timestamp >= '2026-04-24 00:00:00'
            GROUP BY ref_doc
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
            LIMIT 50
        `, [sku]);

        console.log("=== DUPLICATE TRANSFER OUT TRANSACTIONS PER ORDER ===");
        if (res.rows.length === 0) {
            console.log("No duplicate Transfer Out transactions found! All orders have exactly 1 deduction.");
        } else {
            console.table(res.rows);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
