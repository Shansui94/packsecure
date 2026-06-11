import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Checking Transfer Out / Stock Out events since today (2026-06-10) ===");
    
    // Fetch all stock deductions today
    const { data: deductions, error } = await s.from('stock_ledger_v2')
        .select('*')
        .in('event_type', ['Transfer Out', 'Stock Out'])
        .gte('timestamp', '2026-06-10T00:00:00.000Z')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${deductions.length} deductions today:`);
    for (const d of deductions) {
        console.log(`- ${d.timestamp}: [${d.loc_id}] SKU: ${d.sku}, qty: ${d.change_qty}, event: ${d.event_type}, ref: ${d.ref_doc}, notes: "${d.notes}"`);
        
        // If it's a delivery order, let's fetch the delivery order details if possible
        if (d.ref_doc && d.ref_doc.startsWith('DO-')) {
            const doId = d.ref_doc;
            const { data: doData, error: doErr } = await s.from('delivery_orders')
                .select('id, status, driver_id, completed_at, created_at, loaded_at')
                .eq('id', doId)
                .maybeSingle();

            if (doErr) {
                console.error(`  Error fetching DO ${doId}:`, doErr.message);
            } else if (doData) {
                console.log(`  --> DO Details: Status: ${doData.status}, Created: ${doData.created_at}, Loaded: ${doData.loaded_at}, Completed: ${doData.completed_at}`);
            }
        }
    }
}

run();
