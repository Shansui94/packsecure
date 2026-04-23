import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

const channel = anonClient.channel('test_anon_t12')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs_v2' }, payload => {
        console.log("!!! ANON RECEIVED EVENT !!!", payload);
    })
    .subscribe((status, err) => {
        console.log("Anon Sub status:", status, err);
    });

setTimeout(async () => {
    // 1. Insert directly utilizing Service Key (to simulate API/Webhook which uses Service Key usually?)
    // WAIT. /api/alarm.ts uses what key?!
    // `const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;`
    // In Vercel, it probably uses SERVICE_ROLE_KEY.
    await adminClient.from('production_logs_v2').insert([{ machine_id: 'T1.2-M01', output_qty: 1, sku: 'TEST2' }]);
    console.log("Admin emitted fake item for T1.2");
}, 2000);

setTimeout(async () => {
    // CLEANUP
    await adminClient.from('production_logs_v2').delete().eq('sku', 'TEST2');
    process.exit(0);
}, 6000);
