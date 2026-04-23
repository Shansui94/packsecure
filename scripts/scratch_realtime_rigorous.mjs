import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

const channel = anonClient.channel('test_realtime_full')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs_v2' }, payload => {
        console.log("=== ANON REALTIME EVENT RECEIVED ===");
        console.log(payload);
    })
    .subscribe((status, err) => {
        console.log("Anon Sub status:", status);
        if (err) console.error("Error:", err);
    });

setTimeout(async () => {
    console.log("Inserting a valid row with service role...");
    // Must bypass any trigger failure by using valid sku "BW-SL-CLR-100Mx100CMx1ROLL-RED"
    // that actually exists in active items, otherwise the trigger rolls back!
    const { data: res, error } = await adminClient.from('production_logs_v2').insert([{ 
        machine_id: 'T1.3-M02', 
        output_qty: 1, 
        sku: 'BW-SL-CLR-100Mx100CMx1ROLL-RED' 
    }]).select();
    
    console.log("Service Insert Result:", res, error ? error : "No Error");
}, 3000);

setTimeout(async () => {
    console.log("Fetching recent rows via Anon to verify it was committed:");
    const { data } = await anonClient.from('production_logs_v2').select('log_id, created_at, sku').order('created_at', { ascending: false }).limit(2);
    console.log("Anon Fetch:", data);
    process.exit(0);
}, 6000);
