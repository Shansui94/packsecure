import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    console.log(`Tracing actions for ${sku} today (2026-04-10)...`);
    
    // 1. Fetch all ledger events for MERAH today
    const { data: ledger, error: err1 } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .gte('timestamp', '2026-04-09T16:00:00Z')
        .order('timestamp', { ascending: true });
        
    if (err1) {
        console.error("Ledger error:", err1);
    } else {
        let net = 0;
        console.log(`\n--- Stock Ledger Events ---`);
        for (const l of ledger) {
            console.log(`[${l.timestamp.substring(11, 19)}] [${l.event_type}] Qty: ${l.change_qty} | Ref: ${l.ref_doc}`);
            net += l.change_qty;
        }
        console.log(`Net Change (excluding initial stock): ${net}`);
    }

    // 2. Fetch sales_orders referencing MERAH today
    const { data: orders, error: err2 } = await supabase
        .from('sales_orders')
        .select('order_number, status, items, updated_at, created_at')
        .gte('created_at', '2026-04-09T16:00:00Z');
        
    if (err2) {
        console.error("Orders error:", err2);
    } else {
        console.log(`\n--- Sales Orders with MERAH ---`);
        let orderedQty = 0;
        for (const o of orders) {
            const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
            const merahItem = items?.find(i => i.sku === sku || i.product === 'MERAH');
            if (merahItem) {
                console.log(`DO: ${o.order_number} | Status: ${o.status} | Qty: ${merahItem.quantity} | Created: ${o.created_at}`);
                orderedQty += Number(merahItem.quantity);
            }
        }
        console.log(`Total Ordered Qty today: ${orderedQty}`);
    }

    // 3. simple_stock events
    const { data: stock, error: err3 } = await supabase
        .from('simple_stock')
        .select('order_number, status, items, created_at')
        .gte('created_at', '2026-04-09T16:00:00Z');
        
    if (err3) {
        console.error("Simple stock error:", err3);
    } else {
        console.log(`\n--- Simple Stock with MERAH ---`);
        let simpleQty = 0;
        for (const s of stock) {
            const items = typeof s.items === 'string' ? JSON.parse(s.items) : s.items;
            const merahItem = items?.find(i => i.sku === sku || i.product === 'MERAH');
            if (merahItem) {
                console.log(`DO: ${s.order_number} | Status: ${s.status} | Qty: ${merahItem.quantity} | Created: ${s.created_at}`);
                simpleQty += Number(merahItem.quantity);
            }
        }
        console.log(`Total Simple Stock Qty today: ${simpleQty}`);
    }
}

run();
