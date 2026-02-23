
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    let output = "--- DEBUG V2 ---\n";

    // 1. Inventory - Try simpler query
    const { data: inv, error: invErr } = await supabase.from('inventory').select('id, name').limit(1); // Guessing columns
    if (invErr) output += `Inventory Error: ${invErr.message}\n`;
    else output += `Inventory Sample: ${JSON.stringify(inv)}\n`;

    // 2. Factories - Get ID
    const { data: fac, error: facErr } = await supabase.from('sys_factories_v2').select('id, name').limit(1);
    if (facErr) output += `Factories Error: ${facErr.message}\n`;
    else output += `Factories Sample: ${JSON.stringify(fac)}\n`;

    // 3. Factory Inv
    const { data: fi, error: fiErr } = await supabase.from('factory_inventory').select('*').limit(1);
    if (fiErr) output += `FactoryInv Error: ${fiErr.message}\n`;
    else output += `FactoryInv Sample: ${JSON.stringify(fi)}\n`;

    fs.writeFileSync('debug_output.txt', output);
    console.log("Written to debug_output.txt");
}

debug();
