
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("--- Verifying Counts ---");

    // 1. Total Count in V2
    const { count: total, error: tErr } = await supabase
        .from('master_items_v2')
        .select('*', { count: 'exact', head: true });

    // 2. Active Count in V2
    const { count: active, error: aErr } = await supabase
        .from('master_items_v2')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');

    console.log(`V2 Total: ${total}`);
    console.log(`V2 Active: ${active}`);

    if (tErr) console.log("Total Error:", tErr.message);
    if (aErr) console.log("Active Error:", aErr.message);
}

verify();
