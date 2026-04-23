import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.u_t2QdbL3j0L8K6g2y3q5E4Pq4_F8w2r6Xj2d5z4Z9g';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('production_logs_v2')
            .select('log_id, sku, output_qty, created_at')
            .eq('machine_id', 'T1.3-M02')
            .not('sku', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);
    console.log("Anon RLS Data:", data);
    console.log("Anon RLS Error:", error);
}
run();
