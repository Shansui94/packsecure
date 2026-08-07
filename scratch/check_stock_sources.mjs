import pg from 'pg';
const { Client } = pg;
import * as dotenv from 'dotenv';
dotenv.config();

// Extract connection details from VITE_SUPABASE_URL or use direct config from apply_inventory_correction_today.js
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

        console.log("\n=== 1. Event Type distribution in stock_ledger_v2 ===");
        const eventRes = await client.query(`
            SELECT event_type, COUNT(*), SUM(change_qty) as total_qty 
            FROM public.stock_ledger_v2 
            GROUP BY event_type
        `);
        console.table(eventRes.rows);

        console.log("\n=== 2. Production Logs v2 summary ===");
        const prodRes = await client.query(`
            SELECT COUNT(*) as total_logs, SUM(output_qty) as total_output 
            FROM public.production_logs_v2
        `);
        console.table(prodRes.rows);

        console.log("\n=== 3. Unsynced Production Logs (missing from ledger) ===");
        const unsyncedRes = await client.query(`
            SELECT COUNT(*) as unsynced_count, SUM(pl.output_qty) as unsynced_qty
            FROM public.production_logs_v2 pl
            WHERE NOT EXISTS (
                SELECT 1 FROM public.stock_ledger_v2 sl
                WHERE sl.ref_doc = pl.log_id::text AND sl.event_type = 'Production'
            )
        `);
        console.table(unsyncedRes.rows);

        console.log("\n=== 4. Check if there are duplicate sync_order_inventory triggers ===");
        const triggerRes = await client.query(`
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'sales_orders'
        `);
        console.table(triggerRes.rows);
        
        console.log("\n=== 5. Check if there are other triggers on production_logs_v2 ===");
        const prodTriggerRes = await client.query(`
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'production_logs_v2'
        `);
        console.table(prodTriggerRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
