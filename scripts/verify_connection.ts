
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("start:", new Date().toISOString());

    // 1. Sys Vehicles (Expect 11)
    const { count: v2, error: v2Err } = await supabase.from('sys_vehicles').select('*', { count: 'exact', head: true });
    console.log(`sys_vehicles: ${v2Err ? v2Err.message : v2}`);

    // 2. Lorries (Expect 11 or 0 if deleted)
    const { count: l, error: lErr } = await supabase.from('lorries').select('*', { count: 'exact', head: true });
    console.log(`lorries: ${lErr ? lErr.message : l}`);

    // 3. Inventory (Expect 247)
    const { count: i, error: iErr } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    console.log(`inventory: ${iErr ? iErr.message : i}`);

    console.log("end:", new Date().toISOString());
}

check();
