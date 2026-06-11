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
    let out = "";
    const log = (msg) => {
        out += msg + "\n";
    };

    try {
        await client.connect();
        log("Connected to PG successfully!");

        const orderNumbers = [
            'DO-yan-260610-001',
            'DO-yan-260608-001',
            'DO-Yashin-260609-001',
            'DO-Bob-260609-001'
        ];

        log("\n--- Checking target orders in sales_orders ---");
        const res = await client.query(`
            SELECT id, order_number, status, items, updated_at, created_at, driver_id, notes
            FROM public.sales_orders
            WHERE order_number = ANY($1)
        `, [orderNumbers]);

        res.rows.forEach(row => {
            log(`\nOrder: ${row.order_number}`);
            log(`  Status: ${row.status}`);
            log(`  Created At: ${row.created_at}`);
            log(`  Updated At: ${row.updated_at}`);
            log(`  Driver ID: ${row.driver_id}`);
            log(`  Notes: ${row.notes}`);
            log(`  Items: ${JSON.stringify(row.items, null, 2)}`);
        });

        log("\n--- Checking recent activity logs for these orders ---");
        const activityRes = await client.query(`
            SELECT timestamp, event_type, notes, ref_doc, sku, change_qty, loc_id
            FROM public.stock_ledger_v2
            WHERE ref_doc = ANY($1)
            ORDER BY timestamp ASC
        `, [orderNumbers]);

        activityRes.rows.forEach(act => {
            log(`- ${act.timestamp}: [${act.loc_id}] [${act.ref_doc}] Event: ${act.event_type}, SKU: ${act.sku}, Qty: ${act.change_qty}, Notes: "${act.notes}"`);
        });

    } catch (e) {
        log("Error: " + e.message);
    } finally {
        await client.end();
        fs.writeFileSync('order_details_output.txt', out);
        console.log("Written output to order_details_output.txt");
    }
}

run();
