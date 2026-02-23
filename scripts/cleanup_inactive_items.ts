
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log("--- Cleaning Up Inactive Items ---");

    // 1. Check Count Before
    const { count: before } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true });
    console.log(`Total Before: ${before}`);

    // 2. Delete Non-Active
    const { error } = await supabase
        .from('master_items_v2')
        .delete()
        .neq('status', 'Active');

    if (error) {
        console.log("Delete Failed:", error.message);
        return;
    }

    // 3. Check Count After
    const { count: after } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true });
    console.log(`Total After: ${after}`);

    // 4. Verify Active Count matches
    const { count: active } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true }).eq('status', 'Active');
    console.log(`Active Count: ${active}`);

    if (after === active) {
        console.log("SUCCESS: Only Active items remain.");
    } else {
        console.log("WARNING: Mismatch detected.");
    }
}

cleanup();
