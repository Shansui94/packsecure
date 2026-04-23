import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM');

const channel = anonClient.channel('test_anon')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs_v2' }, payload => {
        console.log("!!! ANON RECEIVED EVENT !!!");
    })
    .subscribe((status, err) => {
        console.log("Anon Sub status:", status, err);
    });

setTimeout(() => {
    adminClient.from('production_logs_v2').insert([{ machine_id: 'T1.3-M02', output_qty: 1, sku: 'TEST-APP' }]);
    console.log("Admin emitted fake item");
}, 2000);

setTimeout(() => {
    process.exit(0);
}, 6000);
