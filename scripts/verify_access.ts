
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("--- Verify Access ---");

    // 1. Lorries (Known Good)
    const { count: lorries, error: lErr } = await supabase.from('lorries').select('*', { count: 'exact', head: true });
    console.log(`Lorries: ${lErr ? lErr.message : lorries}`);

    // 2. Inventory (Problematic)
    const { count: inv, error: iErr } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    console.log(`Inventory: ${iErr ? iErr.message : inv}`);

    // 3. Case Variations
    const { count: invCap, error: iCapErr } = await supabase.from('Inventory').select('*', { count: 'exact', head: true });
    console.log(`Inventory (Cap): ${iCapErr ? iCapErr.message : invCap}`);

    // 4. Other Candidates
    const { count: mi, error: mErr } = await supabase.from('master_items').select('*', { count: 'exact', head: true });
    console.log(`master_items: ${mErr ? mErr.message : mi}`);
}

verify();
