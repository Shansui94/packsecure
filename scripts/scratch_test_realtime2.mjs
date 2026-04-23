import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const channel = supabase.channel('test')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs_v2' }, payload => {
        console.log("!!! Received realtime payload:", payload);
    })
    .subscribe((status) => {
        console.log("Sub status:", status);
    });

setTimeout(() => {
    supabase.from('production_logs_v2').insert([{ machine_id: 'T1.3-M02', output_qty: 1, sku: 'TEST-APP' }]).then(res => console.log("Test insert:", res));
}, 2000);

setTimeout(() => {
    process.exit(0);
}, 4000);
