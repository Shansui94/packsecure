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

async function checkLedger(client, orderNum) {
    const res = await client.query(`
        SELECT timestamp, event_type, sku, change_qty, loc_id, notes 
        FROM public.stock_ledger_v2 
        WHERE ref_doc = $1 
        ORDER BY timestamp ASC
    `, [orderNum]);
    return res.rows;
}

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to PG successfully!");

        const testOrderNum = 'DO-TEST-TRIGGER-999';
        
        // Clean up any old test order first
        await client.query(`DELETE FROM public.sales_orders WHERE order_number = $1`, [testOrderNum]);
        await client.query(`DELETE FROM public.stock_ledger_v2 WHERE ref_doc = $1`, [testOrderNum]);

        console.log("\n1. Inserting test order with status 'New'...");
        const itemsJson = JSON.stringify([
            {
                sku: 'BW-SL-CLR-100Mx50CMx2ROLL-ORN',
                product: 'OREN',
                quantity: 5,
                sourceLocation: 'OPM Lama'
            }
        ]);
        
        await client.query(`
            INSERT INTO public.sales_orders (order_number, customer, status, items)
            VALUES ($1, 'Test Customer', 'New', $2::jsonb)
        `, [testOrderNum, itemsJson]);

        let ledger = await checkLedger(client, testOrderNum);
        console.log(`- Ledger entries for 'New': ${ledger.length}`);
        if (ledger.length !== 0) {
            throw new Error("Expected 0 ledger entries for 'New' status.");
        }

        console.log("\n2. Updating status to 'Loaded'...");
        await client.query(`
            UPDATE public.sales_orders 
            SET status = 'Loaded' 
            WHERE order_number = $1
        `, [testOrderNum]);

        ledger = await checkLedger(client, testOrderNum);
        console.log(`- Ledger entries for 'Loaded': ${ledger.length}`);
        ledger.forEach(l => console.log(`  * ${l.event_type} | ${l.sku} | ${l.change_qty} | ${l.notes}`));
        
        if (ledger.length !== 1 || Number(ledger[0].change_qty) !== -5 || ledger[0].event_type !== 'Transfer Out') {
            throw new Error("Invalid ledger entries for 'Loaded' status.");
        }

        console.log("\n3. Updating status to 'Delivered' (no item changes)...");
        await client.query(`
            UPDATE public.sales_orders 
            SET status = 'Delivered' 
            WHERE order_number = $1
        `, [testOrderNum]);

        ledger = await checkLedger(client, testOrderNum);
        console.log(`- Ledger entries for 'Delivered': ${ledger.length}`);
        ledger.forEach(l => console.log(`  * ${l.event_type} | ${l.sku} | ${l.change_qty} | ${l.notes}`));

        if (ledger.length !== 1) {
            throw new Error("Expected no new ledger entries when moving from Loaded to Delivered.");
        }

        console.log("\n4. Updating status to 'Cancelled' (should trigger refund)...");
        await client.query(`
            UPDATE public.sales_orders 
            SET status = 'Cancelled' 
            WHERE order_number = $1
        `, [testOrderNum]);

        ledger = await checkLedger(client, testOrderNum);
        console.log(`- Ledger entries for 'Cancelled': ${ledger.length}`);
        ledger.forEach(l => console.log(`  * ${l.event_type} | ${l.sku} | ${l.change_qty} | ${l.notes}`));

        if (ledger.length !== 2) {
            throw new Error("Expected 2 ledger entries (1 Transfer Out, 1 Transfer In/Refund).");
        }
        
        const refund = ledger[1];
        if (Number(refund.change_qty) !== 5 || refund.event_type !== 'Transfer In') {
            throw new Error("Refund entry is invalid.");
        }

        console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");

        // Clean up
        console.log("\nCleaning up test data...");
        await client.query(`DELETE FROM public.sales_orders WHERE order_number = $1`, [testOrderNum]);
        await client.query(`DELETE FROM public.stock_ledger_v2 WHERE ref_doc = $1`, [testOrderNum]);
        console.log("Cleanup done.");

    } catch (e) {
        console.error("❌ TEST FAILED:", e.message);
    } finally {
        await client.end();
    }
}

run();
