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

        // 1. Fetch Transfer Out entries since auditTime
        const res = await client.query(`
            SELECT txn_id, timestamp, change_qty, loc_id, notes, ref_doc
            FROM public.stock_ledger_v2
            WHERE sku = $1 AND event_type = 'Transfer Out' AND timestamp >= $2
            ORDER BY timestamp ASC
        `, [sku, auditTime]);

        console.log(`\n=== Transfer Out transactions for MERAH since last audit (${auditTime}) ===`);
        console.table(res.rows);

        if (res.rows.length > 0) {
            const docRefs = res.rows.map(r => r.ref_doc).filter(Boolean);
            
            // 2. Query sales orders for these document references
            const orderRes = await client.query(`
                SELECT order_number, status, created_at, updated_at, items
                FROM public.sales_orders
                WHERE order_number = ANY($1::text[])
            `, [docRefs]);

            console.log("\n=== Sales Orders Details ===");
            orderRes.rows.forEach(order => {
                const item = order.items.find(i => i.sku === sku);
                console.log(`Order: ${order.order_number}`);
                console.log(`  Status: ${order.status}`);
                console.log(`  Created: ${order.created_at}`);
                console.log(`  Updated: ${order.updated_at}`);
                console.log(`  Items Qty of MERAH: ${item ? item.quantity : 'not found'}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
