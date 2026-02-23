
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    let output = "--- PROBE START ---\n";

    // 1. Confirm Count first
    const { count, error: cErr } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    output += `Inventory Count: ${cErr ? cErr.message : count}\n`;

    // 2. Probe Inventory Columns - Try generic
    const invCols = ['id', 'ID', 'Id', 'sku', 'SKU', 'Raw_Material_ID', 'name', 'Name', 'Material_Name', 'qty', 'Stock_Kg'];
    for (const col of invCols) {
        const { error } = await supabase.from('inventory').select(col).limit(1);
        output += `Inventory [${col}]: ${error ? error.message : 'OK'}\n`;
    }

    // 3. Probe Factories Columns
    const facCols = ['id', 'ID', 'factory_id', 'name'];
    for (const col of facCols) {
        const { error } = await supabase.from('sys_factories_v2').select(col).limit(1);
        output += `Factories [${col}]: ${error ? error.message : 'OK'}\n`;
    }

    // 4. Probe Factory Inventory Columns
    const fiCols = ['id', 'ID', 'item_id', 'factory_id', 'quantity'];
    for (const col of fiCols) {
        const { error } = await supabase.from('factory_inventory').select(col).limit(1);
        output += `FactoryInv [${col}]: ${error ? error.message : 'OK'}\n`;
    }

    fs.writeFileSync('probe.log', output);
    console.log("Written to probe.log");
}

probe();
