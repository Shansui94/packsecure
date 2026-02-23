
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
// Ensure this is SERVICE ROLE KEY
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceCleanup() {
    let output = "--- Force Cleanup Inactive Items ---\n";

    // 1. Get Inactive SKUs
    const { data: inactiveItems } = await supabase
        .from('master_items_v2')
        .select('sku')
        .neq('status', 'Active');

    if (!inactiveItems || inactiveItems.length === 0) {
        output += "No inactive items found.\n";
        fs.writeFileSync('force_cleanup.log', output);
        return;
    }

    const skus = inactiveItems.map(i => i.sku);
    output += `Target Inactive SKUs: ${skus.length}\n`;

    // 2. Delete Dependencies (Batch if needed, but <300 SKUs is fine for 'in')
    // A. Production Logs
    const { count: delLogs, error: errLogs } = await supabase
        .from('production_logs_v2')
        .delete({ count: 'exact' })
        .in('sku', skus);
    output += `Deleted Production Logs: ${delLogs ?? 0} (Err: ${errLogs?.message})\n`;

    // B. Stock Ledger
    const { count: delLedger, error: errLedger } = await supabase
        .from('stock_ledger_v2')
        .delete({ count: 'exact' })
        .in('sku', skus);
    output += `Deleted Stock Ledger: ${delLedger ?? 0} (Err: ${errLedger?.message})\n`;

    // C. BOM Items (where material is inactive)
    const { count: delBomItems, error: errBomItems } = await supabase
        .from('bom_items_v2')
        .delete({ count: 'exact' })
        .in('material_sku', skus);
    output += `Deleted BOM Items (as material): ${delBomItems ?? 0} (Err: ${errBomItems?.message})\n`;

    // D. Sales Order Items
    const { count: delSoItems, error: errSoItems } = await supabase
        .from('sales_order_items_v2')
        .delete({ count: 'exact' })
        .in('sku', skus);
    output += `Deleted SO Items: ${delSoItems ?? 0} (Err: ${errSoItems?.message})\n`;

    // 3. Delete Items
    const { count: delItems, error: errItems } = await supabase
        .from('master_items_v2')
        .delete({ count: 'exact' })
        .neq('status', 'Active');
    output += `Deleted Items: ${delItems ?? 0} (Err: ${errItems?.message})\n`;

    // 4. Final Verify
    const { count: remaining } = await supabase
        .from('master_items_v2')
        .select('*', { count: 'exact', head: true });
    output += `Remaining Items Total: ${remaining}\n`;

    fs.writeFileSync('force_cleanup.log', output);
    console.log("Cleanup complete. Log written to force_cleanup.log");
}

forceCleanup();
