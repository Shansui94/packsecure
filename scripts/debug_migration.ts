
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("--- DEBUGGING ---");

    // 1. Inventory
    const { data: inv, error: invErr } = await supabase.from('inventory').select('*').limit(1);
    if (invErr) console.log("Inventory Error:", invErr.message, invErr.details, invErr.hint);
    else console.log("Inventory Keys:", inv?.[0] ? Object.keys(inv[0]) : "Empty Result");

    // 2. Sys Factories V2
    const { data: fac, error: facErr } = await supabase.from('sys_factories_v2').select('*').limit(1);
    if (facErr) console.log("Factories Error:", facErr.message);
    else console.log("Factories Keys:", fac?.[0] ? Object.keys(fac[0]) : "Empty Result");

    // 3. Factory Inventory
    const { data: fi, error: fiErr } = await supabase.from('factory_inventory').select('*').limit(1);
    if (fiErr) console.log("FactoryInv Error:", fiErr.message);
    else console.log("FactoryInv Keys:", fi?.[0] ? Object.keys(fi[0]) : "Empty Result");
}

debug();
