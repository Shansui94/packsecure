
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("--- Post-Cleanup Verification ---");

    // 1. Check Items Count
    const { count: items, error: iErr } = await supabase
        .from('master_items_v2')
        .select('*', { count: 'exact', head: true });

    console.log(`Items Remaining: ${items} (Expected 217)`);
    if (iErr) console.log("Items Error:", iErr.message);

    console.log("\n--- Customer Verification ---");
    // 2. Sample Customers
    const { data: legacy } = await supabase.from('sys_clients').select('*').limit(3);
    const { data: v2 } = await supabase.from('sys_customers').select('*').limit(3);

    console.log("Legacy Sample:", legacy ? legacy.length + " rows" : "None");
    if (legacy && legacy[0]) console.log("L-Sample:", legacy[0]);

    console.log("V2 Sample:", v2 ? v2.length + " rows" : "None");
    if (v2 && v2[0]) console.log("V2-Sample:", v2[0]);

    // Check counts again
    const { count: cLegacy } = await supabase.from('sys_clients').select('*', { count: 'exact', head: true });
    const { count: cV2 } = await supabase.from('sys_customers').select('*', { count: 'exact', head: true });
    console.log(`Legacy Customers: ${cLegacy}, V2 Customers: ${cV2}`);
}

verify();
