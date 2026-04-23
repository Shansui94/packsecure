import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data: machines, error } = await supabase.from('sys_machines_v2').select('*');
    if (error) console.error(error);
    console.log("All machines:", machines);

    const { data: logs } = await supabase.from('production_logs_v2').select('*').limit(20).order('created_at', { ascending: false });
    console.log("Recent logs:", logs.map(l => ({ m_id: l.machine_id, qty: l.output_qty, created: l.created_at })));
}
run();
