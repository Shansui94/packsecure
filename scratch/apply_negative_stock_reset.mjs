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

        // 1. Find all negative SKU + Location balances in the ledger
        const checkRes = await client.query(`
            SELECT sku, loc_id, SUM(change_qty) as balance
            FROM public.stock_ledger_v2
            GROUP BY sku, loc_id
            HAVING SUM(change_qty) < 0
        `);

        if (checkRes.rows.length === 0) {
            console.log("No negative stock balances found to correct!");
            return;
        }

        console.log(`\nFound ${checkRes.rows.length} negative stock balances to reset:`);
        console.table(checkRes.rows);

        // Begin transaction to ensure consistency
        await client.query('BEGIN');
        console.log("\nStarting database transaction...");

        for (const row of checkRes.rows) {
            const sku = row.sku;
            const locId = row.loc_id; // could be null
            const balance = Number(row.balance);
            const correctionQty = Math.abs(balance);

            console.log(`Resetting SKU ${sku} at location [${locId}] from ${balance} to 0 (adding +${correctionQty})...`);

            await client.query(`
                INSERT INTO public.stock_ledger_v2 (
                    timestamp, event_type, sku, change_qty, loc_id, notes, ref_doc
                ) VALUES (
                    NOW(), 'System Reset', $1, $2, $3,
                    $4, 'RESET-20260620'
                )
            `, [
                sku, 
                correctionQty, 
                locId, 
                `System Correction: Reset negative stock balance to 0 (Offsetting ${balance})`
            ]);
        }

        await client.query('COMMIT');
        console.log("\n✅ Transaction committed successfully! All negative stock balances have been reset to 0.");

    } catch (e) {
        console.error("Error occurred, rolling back...", e);
        await client.query('ROLLBACK');
    } finally {
        await client.end();
    }
}

run();
