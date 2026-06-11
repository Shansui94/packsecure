import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log("Fetching recent sales_orders...");
    // Let's fetch the last 100 orders
    const { data: orders, error: ordersErr } = await s.from('sales_orders')
        .select('id, order_number, customer, status, items, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

    if (ordersErr) {
        console.error("Error fetching orders:", ordersErr);
        return;
    }

    console.log(`Analyzing ${orders.length} recent orders...`);
    
    for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;

        // Check if any item has sourceLocation = 'OPM Lama'
        const hasOpmLama = order.items.some(item => {
            const loc = item.sourceLocation || '';
            return loc.toLowerCase().includes('opm lama') || loc.toLowerCase().includes('opm_lama');
        });

        if (!hasOpmLama) continue;

        console.log(`\n-------------------------------------------------------------`);
        console.log(`Order: ${order.order_number} | Customer: ${order.customer} | Status: ${order.status} | Created: ${order.created_at}`);
        
        // Print expected items from OPM Lama
        const expectedItems = {};
        order.items.forEach(item => {
            const loc = item.sourceLocation || '';
            if (loc.toLowerCase().includes('opm lama') || loc.toLowerCase().includes('opm_lama')) {
                const sku = item.sku || item.product;
                expectedItems[sku] = (expectedItems[sku] || 0) + Number(item.quantity);
                console.log(`  Expected Deduction: SKU ${sku} | Qty ${item.quantity}`);
            }
        });

        // Query ledger entries for this order number and OPM Lama
        const { data: ledger, error: ledgerErr } = await s.from('stock_ledger_v2')
            .select('*')
            .eq('ref_doc', order.order_number)
            .eq('loc_id', 'OPM Lama');

        if (ledgerErr) {
            console.error(`  Error fetching ledger for ${order.order_number}:`, ledgerErr);
            continue;
        }

        console.log(`  Ledger Entries found: ${ledger.length}`);
        
        // Group ledger entries by SKU and calculate sum
        const actualDeductions = {};
        ledger.forEach(entry => {
            console.log(`    - txn_id: ${entry.txn_id} | event: ${entry.event_type} | SKU: ${entry.sku} | qty: ${entry.change_qty} | TS: ${entry.timestamp} | notes: ${entry.notes}`);
            const sku = entry.sku;
            actualDeductions[sku] = (actualDeductions[sku] || 0) + Number(entry.change_qty);
        });

        // Check for double deduction or discrepancy
        Object.entries(expectedItems).forEach(([sku, expectedQty]) => {
            const actualQty = actualDeductions[sku] || 0;
            // Since deductions are negative in ledger:
            const netDeduction = -actualQty; 
            if (netDeduction !== expectedQty) {
                console.log(`  🚨 DISCREPANCY for SKU ${sku}: Expected deduction ${expectedQty}, but actual net deduction in ledger is ${netDeduction}`);
            } else {
                console.log(`  ✅ Match for SKU ${sku}: expected ${expectedQty}, got ${netDeduction}`);
            }
        });
    }
}

run();
