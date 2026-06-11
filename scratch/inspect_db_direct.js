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

        // 1. Fetch triggers on sales_orders
        console.log("\n=== Active Triggers on sales_orders ===");
        const triggerRes = await client.query(`
            SELECT 
                tgname as trigger_name,
                tgenabled as enabled,
                pg_get_triggerdef(oid) as trigger_definition
            FROM pg_trigger 
            WHERE tgrelid = 'public.sales_orders'::regclass;
        `);
        triggerRes.rows.forEach(r => {
            console.log(`Trigger: ${r.trigger_name} (Enabled: ${r.enabled})`);
            console.log(`Def: ${r.trigger_definition}\n`);
        });

        // 2. Fetch definition of sync_order_inventory function
        console.log("\n=== Definition of sync_order_inventory ===");
        const funcRes = await client.query(`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname = 'sync_order_inventory';
        `);
        if (funcRes.rows.length > 0) {
            console.log(funcRes.rows[0].definition);
        } else {
            console.log("Function sync_order_inventory not found.");
        }

        // 3. Let's see what function and triggers are bound to other tables, or if there is another trigger on sales_orders
        // that matches "deduct" or "loading"
        console.log("\n=== Checking for all trigger functions containing 'loading' or 'deduct' ===");
        const funcMatchRes = await client.query(`
            SELECT proname, pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname ILIKE '%loading%' OR proname ILIKE '%deduct%' OR proname ILIKE '%delivery%';
        `);
        funcMatchRes.rows.forEach(r => {
            console.log(`Function: ${r.proname}`);
            console.log(`Def: ${r.definition}\n`);
        });

    } catch (e) {
        console.error("PG Connection/Query error", e);
    } finally {
        await client.end();
    }
}

run();
