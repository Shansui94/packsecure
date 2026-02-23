
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let output = `Start: ${new Date().toISOString()}\n`;

    // Check known tables
    const { count: v2, error: v2Err } = await supabase.from('sys_vehicles').select('*', { count: 'exact', head: true });
    output += `sys_vehicles: ${v2Err ? v2Err.message : v2}\n`;

    const { count: l, error: lErr } = await supabase.from('lorries').select('*', { count: 'exact', head: true });
    output += `lorries: ${lErr ? lErr.message : l}\n`;

    const { count: i, error: iErr } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
    output += `inventory: ${iErr ? iErr.message : i}\n`;

    fs.writeFileSync('conn_status.log', output);
}

check();
