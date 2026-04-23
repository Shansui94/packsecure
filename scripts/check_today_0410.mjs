import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Fetching today's (2026-04-10) activities...");
    
    // 1. Fetch today's ledger entries (UTC+8: April 10 00:00 to 23:59 -> April 9 16:00 UTC to April 10 15:59 UTC)
    const { data: ledger, error: err1 } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .gte('timestamp', '2026-04-09T16:00:00Z');
        
    if (err1) {
        console.error("Ledger error:", err1);
    } else {
        console.log(`Found ${ledger.length} ledger entries for today.`);
        for (const l of ledger) {
            console.log(`- [${l.event_type}] SKU: ${l.sku} | Qty: ${l.change_qty} | Ref: ${l.ref_doc} | Time: ${l.timestamp}`);
        }
    }

    // 2. Fetch today's sales orders
    const { data: orders, error: err2 } = await supabase
        .from('sales_orders')
        .select('*')
        .gte('created_at', '2026-04-09T16:00:00Z');
        
    if (err2) {
        console.error("Orders error:", err2);
    } else {
        console.log(`\nFound ${orders.length} new sales orders for today.`);
        for (const o of orders) {
            console.log(`- Order: ${o.order_number} | Status: ${o.status} | Items: ${JSON.stringify(o.items)}`);
        }
    }
    
    // 3. Simple stock records mapped
    const { data: stock, error: err3 } = await supabase
        .from('simple_stock')
        .select('*')
        .order('id', { ascending: false })
        .limit(10);
        
    if (stock) {
        console.log(`\nRecent simple_stock records:`);
        for (const s of stock) {
            console.log(`- ${s.order_number} | Status: ${s.status} | Deduct: ${s.deduction_status} | Items: ${JSON.stringify(s.items)}`);
        }
    }
}

run();
