import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function renameSku() {
    const oldSku = 'BW-SL-CLR-100Mx100CMx1ROLL-ORN';
    const newSku = 'BW-SL-CLR-100Mx100CMx2ROLL-ORN';

    console.log("Starting SKU rename process from", oldSku, "to", newSku);

    // We must execute a raw SQL query or an RPC since there are foreign keys (like sales_order_items_v2_sku_fkey) that restrict updates implicitly.
    // Instead of dropping keys, we can insert the new one, re-point the child records, and delete the old one.

    // 1. Get the old product details
    const { data: oldItem, error: fetchErr } = await supabaseAdmin.from('master_items_v2').select('*').eq('sku', oldSku).single();
    if (!oldItem) {
        console.log("Old SKU not found. It might have already been renamed.");
        return;
    }

    // 2. Insert new SKU record
    const { error: insertErr } = await supabaseAdmin.from('master_items_v2').upsert({
        ...oldItem,
        sku: newSku,
        name: newSku
    });

    if (insertErr) {
        console.error("Failed to insert new SKU:", insertErr);
        return;
    }
    console.log("Created new SKU entry:", newSku);

    // 3. Re-point child tables (stock_ledger_v2)
    const { error: err1 } = await supabaseAdmin.from('stock_ledger_v2').update({ sku: newSku }).eq('sku', oldSku);
    if (err1) console.error("Failed updating stock_ledger_v2:", err1);
    else console.log("Updated stock ledger");

    // 4. Re-point child tables (sales_order_items_v2)
    const { error: err2 } = await supabaseAdmin.from('sales_order_items_v2').update({ sku: newSku }).eq('sku', oldSku);
    if (err2) console.error("Failed updating sales_order_items_v2:", err2);
    else console.log("Updated sales orders");

    // 5. Delete old SKU
    const { error: deleteErr } = await supabaseAdmin.from('master_items_v2').delete().eq('sku', oldSku);
    if (deleteErr) console.error("Failed to delete old SKU:", deleteErr);
    else console.log("Deleted old SKU:", oldSku);

    console.log("Rename complete!");
}

renameSku();
