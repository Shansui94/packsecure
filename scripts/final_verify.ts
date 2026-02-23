
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    let output = "--- Final Verification ---\n";

    // 1. Items Count
    const { count: items } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true });
    output += `Items (V2): ${items}\n`;

    // 2. Customers Count
    const { count: cLegacy } = await supabase.from('sys_clients').select('*', { count: 'exact', head: true });
    const { count: cV2 } = await supabase.from('sys_customers').select('*', { count: 'exact', head: true });
    output += `Customers: Legacy=${cLegacy}, V2=${cV2}\n`;

    // 3. Compare One Customer
    const { data: legacy } = await supabase.from('sys_clients').select('*').limit(1);
    const { data: v2 } = await supabase.from('sys_customers').select('*').limit(1);

    if (legacy && legacy[0]) output += `Legacy Sample: ${JSON.stringify(legacy[0])}\n`;
    if (v2 && v2[0]) output += `V2 Sample: ${JSON.stringify(v2[0])}\n`;

    fs.writeFileSync('final_verify.txt', output);
    console.log("Written to final_verify.txt");
}

verify();
