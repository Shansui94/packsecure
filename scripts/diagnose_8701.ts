import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    const orderNo = 'DO-2026-8701';
    console.log(`\n=== Diagnosing Order: ${orderNo} ===\n`);

    // 1. Fetch Order Details
    const { data: order, error: orderErr } = await supabaseAdmin
        .from('sales_orders')
        .select('id, order_number, factory_id, customer, status, notes, items, created_at, updated_at')
        .eq('order_number', orderNo)
        .single();
        
    if (orderErr) {
        console.error("Failed to fetch order:", orderErr);
        return;
    }
    
    console.log("Order Header:");
    console.log(`- Order Number: ${order.order_number}`);
    console.log(`- Customer: ${order.customer}`);
    console.log(`- Factory ID (Header): ${order.factory_id}`);
    console.log(`- Status: ${order.status}`);
    console.log(`- Notes: ${order.notes || 'N/A'}`);
    console.log(`- Created At: ${order.created_at}`);
    console.log(`- Updated At: ${order.updated_at}`);
    
    console.log("\nOrder Items (JSON array):");
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any, i: number) => {
            console.log(`  [${i}] SKU: ${item.sku || item.product}, Qty: ${item.quantity}, sourceLocation: ${item.sourceLocation || 'N/A'}, remark: ${item.remark || 'N/A'}`);
        });
    } else {
        console.log("  No items or wrong format.");
    }

    // 2. Fetch Ledger Entries for this order
    const { data: ledger, error: ledgerErr } = await supabaseAdmin
        .from('stock_ledger_v2')
        .select('txn_id, timestamp, sku, change_qty, loc_id, event_type, notes, ref_doc')
        .eq('ref_doc', orderNo)
        .order('timestamp', { ascending: true });

    if (ledgerErr) {
        console.error("Failed to fetch ledger:", ledgerErr);
        return;
    }

    console.log(`\n=== Ledger Entries for ${orderNo} (${ledger.length} total) ===\n`);
    if (ledger.length > 0) {
        console.table(ledger, ['timestamp', 'sku', 'change_qty', 'loc_id', 'event_type', 'notes']);
        // Summary
        console.log("\nSummary by loc_id and SKU:");
        const summary: Record<string, number> = {};
        ledger.forEach((l: any) => {
            const key = `${l.loc_id} | ${l.sku}`;
            summary[key] = (summary[key] || 0) + Number(l.change_qty);
        });
        console.table(Object.entries(summary).map(([k, v]) => {
            const [loc, sku] = k.split(' | ');
            return { Location: loc, SKU: sku, NetChange: v };
        }));
    } else {
        console.log("No ledger entries found for this order.");
    }

    // 3. Check which trigger version is active
    const { data: triggerInfo, error: trigErr } = await supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.sales_orders'::regclass AND tgname LIKE '%order%' OR tgname LIKE '%sync%' OR tgname LIKE '%deduct%' OR tgname LIKE '%refund%' OR tgname LIKE '%delivery%';`
    }).maybeSingle();

    if (!trigErr && triggerInfo) {
        console.log("\n=== Active Triggers on sales_orders ===");
        console.log(triggerInfo);
    }
}

run();
