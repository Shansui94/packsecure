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

        const res = await client.query(`
            SELECT sku, change_qty, notes, timestamp, ref_doc
            FROM public.stock_ledger_v2
            WHERE event_type = 'System Reset'
            ORDER BY timestamp DESC
            LIMIT 50
        `);

        console.table(res.rows);

        // Also get unique notes patterns and sum
        const patternRes = await client.query(`
            SELECT notes, COUNT(*), SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE event_type = 'System Reset'
            GROUP BY notes
            ORDER BY COUNT(*) DESC
        `);
        console.log("\n--- Unique notes pattern for 'System Reset' ---");
        console.table(patternRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
