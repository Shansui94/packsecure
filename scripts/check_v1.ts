import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://kdahubyhwndgyloaljak.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM'
);

async function checkTriggers() {
    console.log("=== API only writes to production_logs (v1) ===");
    
    // Check if new production_logs exist after 06:35
    const { data: v1Logs } = await supabase
        .from('production_logs')
        .select('*')
        .gte('created_at', '2026-03-27T06:35:00+00:00')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(`New production_logs (v1) entries: ${v1Logs?.length || 0}`);
    v1Logs?.forEach(r => console.log(`  ${r.machine_id} | qty: ${r.alarm_count} | ${r.created_at}`));

    // Check triggers on production_logs
    const { data: cols, error: e } = await supabase.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation, action_statement 
              FROM information_schema.triggers 
              WHERE event_object_table = 'production_logs'`
    });

    if (e) {
        console.log("RPC Error:", e.message);
    } else {
        console.log("Triggers on production_logs:", cols);
    }
}

checkTriggers().catch(console.error);
