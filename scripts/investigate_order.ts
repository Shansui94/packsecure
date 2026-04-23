import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    console.log("Checking recent sales orders for 'test' or driver 'test' around 2026-04-20...");
    
    // Check sales orders
    const { data: orders, error: orderError } = await supabaseAdmin
        .from('sales_orders')
        .select('id, order_number, customer, status, order_date, created_at, items, factory_id, trip_origin')
        .gte('created_at', '2026-04-19T00:00:00Z')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (orderError) {
        console.error("Sales Orders fetch error:", orderError);
    } else {
        console.log("Recent Sales Orders:");
        console.table(orders.map(o => ({
            id: o.id,
            order_number: o.order_number,
            customer: o.customer,
            status: o.status,
            factory_id: o.factory_id,
            trip_origin: o.trip_origin,
            created_at: o.created_at,
            items_preview: JSON.stringify(o.items).substring(0, 50) + "..."
        })));
        
        if (orders.length > 0) {
            const orderNumbers = orders.map(o => o.order_number);
            
            // Check stock ledger for these DO numbers
            const { data: ledgers, error: ledgerError } = await supabaseAdmin
                .from('stock_ledger_v2')
                .select('txn_id, sku, loc_id, change_qty, event_type, ref_doc, notes, timestamp')
                .in('ref_doc', orderNumbers);
                
            if (ledgerError) {
                console.error("Stock Ledger fetch error:", ledgerError);
            } else {
                console.log("\nStock Ledger Entries for these orders:");
                console.table(ledgers);
            }
        }
    }
}
run();
