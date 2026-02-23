
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("--- Inspecting Legacy IDs ---");
    const { data: legacy, error: lErr } = await supabase.from('inventory').select('id, SKU_ID, Raw_Material_ID, qty, Stock_Kg').limit(3);
    if (lErr) console.log("Legacy Error:", lErr.message);
    else console.log("Legacy Sample:", legacy);

    console.log("\n--- Inspecting Factory Inventory Schema ---");
    const { data: fi, error: fiErr } = await supabase.from('factory_inventory').select('*').limit(1);
    if (fiErr) console.log("FI Error:", fiErr.message);
    else console.log(fi?.[0] ? Object.keys(fi[0]) : "Empty Table (Keys unknown)");

    // Also confirm sys_factories_v2 to get a factory ID to link to
    const { data: factories } = await supabase.from('sys_factories_v2').select('id, name').limit(1);
    console.log("Factories:", factories);
}

inspect();
