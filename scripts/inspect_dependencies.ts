
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    let output = "--- Dependency Check for Inactive Items ---\n";

    // 1. Get Inactive SKUs
    const { data: inactiveItems } = await supabase
        .from('master_items_v2')
        .select('sku')
        .neq('status', 'Active');

    if (!inactiveItems || inactiveItems.length === 0) {
        output += "No inactive items found?\n";
        fs.writeFileSync('dep_check.log', output);
        return;
    }

    const skus = inactiveItems.map(i => i.sku);
    output += `Inactive SKUs Count: ${skus.length}\n`;

    // 2. Check Tables
    const tables = [
        { name: 'production_logs_v2', col: 'sku' },
        { name: 'bom_headers_v2', col: 'sku' },
        { name: 'bom_items_v2', col: 'material_sku' },
        { name: 'stock_ledger_v2', col: 'sku' },
        { name: 'sales_order_items_v2', col: 'sku' }
    ];

    for (const t of tables) {
        // Checking in batches if too many SKUs? 288 is fine for distinct check
        // Supabase `in` filter might have a limit, but <1000 usually ok.
        const { count, error } = await supabase
            .from(t.name)
            .select('*', { count: 'exact', head: true })
            .in(t.col, skus);

        output += `Table '${t.name}': ${error ? error.message : count} references\n`;
    }

    fs.writeFileSync('dep_check.log', output);
}

inspect();
