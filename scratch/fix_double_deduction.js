import pg from 'pg';
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
    try {
        await client.connect();
        console.log("Connected to PG database successfully!");

        // 1. Check current triggers
        console.log("\n--- Checking current triggers on sales_orders ---");
        const triggers = await client.query(`
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgrelid = 'public.sales_orders'::regclass AND NOT tgisinternal;
        `);
        console.log("Active triggers:", triggers.rows.map(r => r.tgname));

        // 2. Count duplicate 'Delivery' ledger entries
        console.log("\n--- Counting 'Delivery' entries in stock_ledger_v2 ---");
        const countRes = await client.query(`
            SELECT COUNT(*), SUM(change_qty) as total_qty
            FROM public.stock_ledger_v2
            WHERE event_type = 'Delivery' AND notes LIKE 'Auto-Deduct on Loading%';
        `);
        console.log(`Found ${countRes.rows[0].count} duplicate entries summing to ${countRes.rows[0].total_qty} units.`);

        // 3. Drop the ghost trigger and function
        console.log("\n--- Dropping ghost trigger 'trg_order_inventory_sync' ---");
        await client.query(`DROP TRIGGER IF EXISTS trg_order_inventory_sync ON public.sales_orders;`);
        console.log("Trigger dropped.");

        console.log("\n--- Dropping ghost function 'handle_order_inventory_sync' ---");
        await client.query(`DROP FUNCTION IF EXISTS public.handle_order_inventory_sync();`);
        console.log("Function dropped.");

        // 4. Delete the duplicate ledger entries
        console.log("\n--- Deleting duplicate ledger entries from stock_ledger_v2 ---");
        const deleteRes = await client.query(`
            DELETE FROM public.stock_ledger_v2
            WHERE event_type = 'Delivery' AND notes LIKE 'Auto-Deduct on Loading%';
        `);
        console.log(`Deleted ${deleteRes.rowCount} duplicate stock ledger entries.`);

        // 5. Verify triggers after fix
        console.log("\n--- Verifying triggers after fix ---");
        const finalTriggers = await client.query(`
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgrelid = 'public.sales_orders'::regclass AND NOT tgisinternal;
        `);
        console.log("Remaining active triggers:", finalTriggers.rows.map(r => r.tgname));

        console.log("\n✅ Database trigger fixed and duplicate deductions cleaned up successfully!");

    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
