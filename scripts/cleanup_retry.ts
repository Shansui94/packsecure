
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
// Ensure this is SERVICE ROLE KEY
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    let output = "--- Cleaning Up Inactive Items (Retry) ---\n";

    // 1. Check Count Before
    const { count: before, error: bErr } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true });
    output += `Total Before: ${before} (Err: ${bErr?.message})\n`;

    // 2. Delete Non-Active
    const { count: deleted, error: dErr } = await supabase
        .from('master_items_v2')
        .delete({ count: 'exact' }) // Request count of deleted rows
        .neq('status', 'Active');

    if (dErr) {
        output += `Delete Failed: ${dErr.message}\n`;
    } else {
        output += `Delete Success. Rows affected: ${deleted}\n`;
    }

    // 3. Check Count After
    const { count: after, error: aErr } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true });
    output += `Total After: ${after} (Err: ${aErr?.message})\n`;

    // 4. Verify Active Count matches
    const { count: active } = await supabase.from('master_items_v2').select('*', { count: 'exact', head: true }).eq('status', 'Active');
    output += `Active Count: ${active}\n`;

    fs.writeFileSync('cleanup_debug.log', output);
}

cleanup();
