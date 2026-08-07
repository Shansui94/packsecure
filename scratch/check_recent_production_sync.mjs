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

        // Total output from production_logs_v2 since 2026-04-24
        const logRes = await client.query(`
            SELECT COUNT(*) as log_count, SUM(output_qty) as log_qty
            FROM public.production_logs_v2
            WHERE created_at >= '2026-04-24 00:00:00'
        `);
        console.log("=== production_logs_v2 (since April 24) ===");
        console.table(logRes.rows);

        // Total change_qty from stock_ledger_v2 since 2026-04-24
        const ledgerRes = await client.query(`
            SELECT COUNT(*) as ledger_count, SUM(change_qty) as ledger_qty
            FROM public.stock_ledger_v2
            WHERE event_type = 'Production' AND timestamp >= '2026-04-24 00:00:00'
        `);
        console.log("\n=== stock_ledger_v2 Production (since April 24) ===");
        console.table(ledgerRes.rows);

        // Check if there are production logs that are not synced to stock_ledger_v2 since April 24
        const unsyncedRes = await client.query(`
            SELECT COUNT(*) as unsynced_count, SUM(output_qty) as unsynced_qty
            FROM public.production_logs_v2 pl
            WHERE created_at >= '2026-04-24 00:00:00' AND NOT EXISTS (
                SELECT 1 FROM public.stock_ledger_v2 sl
                WHERE sl.ref_doc = pl.log_id::text AND sl.event_type = 'Production'
            )
        `);
        console.log("\n=== Unsynced Production logs (since April 24) ===");
        console.table(unsyncedRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
