import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    // Fetch ledger entries for OPM Lama around April 20th
    const { data: ledger, error: lError } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('loc_id', 'OPM Lama')
        .gte('timestamp', '2026-04-19T00:00:00Z')
        .lte('timestamp', '2026-04-21T23:59:59Z');
        
    if (lError) return console.error(lError);

    // Get unique ref_docs that are Delivery Orders
    const doRefs = Array.from(new Set(ledger.map(l => l.ref_doc).filter(ref => ref && ref.startsWith('DO-'))));
    
    // Fetch corresponding Sales Orders to see their actual factory_id
    const { data: orders, error: oError } = await supabase.from('sales_orders')
        .select('order_number, factory_id')
        .in('order_number', doRefs);
        
    if (oError) return console.error(oError);
    
    const orderMap = {};
    orders.forEach(o => orderMap[o.order_number] = o.factory_id);
    
    console.log("=== CROSS-LOCATION MISMATCH ANALYSIS ===");
    
    let mismatchCount = 0;
    const mismatchedSkus = new Set();
    
    ledger.forEach(l => {
        if (!l.ref_doc || !l.ref_doc.startsWith('DO-')) return;
        const actualFactory = orderMap[l.ref_doc];
        
        if (actualFactory && actualFactory !== l.loc_id) {
            console.log(`Mismatch Found:`);
            console.log(`  DO Number: ${l.ref_doc}`);
            console.log(`  Actual Order Location: ${actualFactory}`);
            console.log(`  Ledger Deducted From: ${l.loc_id}`);
            console.log(`  SKU: ${l.sku}`);
            console.log(`  Qty: ${l.change_qty}`);
            console.log(`  Date: ${l.timestamp}`);
            console.log(`  Notes: ${l.notes}`);
            console.log('---------------------------');
            mismatchCount++;
            mismatchedSkus.add(l.sku);
        }
    });
    
    console.log(`\nTotal mismatches found: ${mismatchCount}`);
    console.log(`SKUs affected:`, Array.from(mismatchedSkus));
}
main();
