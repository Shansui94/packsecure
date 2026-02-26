import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check T1.2-M01
    const { data: d1, error: e1 } = await supabase
        .from('production_logs')
        .select('machine_id, alarm_count, created_at')
        .eq('machine_id', 'T1.2-M01')
        .gte('created_at', today.toISOString());

    console.log('T1.2-M01 Logs:', d1?.length, 'Total Rolls:', d1?.reduce((a, b) => a + (b.alarm_count || 0), 0));

    // Check T1.3-M02
    const { data: d2, error: e2 } = await supabase
        .from('production_logs')
        .select('machine_id, alarm_count, created_at')
        .eq('machine_id', 'T1.3-M02')
        .gte('created_at', today.toISOString());

    console.log('T1.3-M02 Logs:', d2?.length, 'Total Rolls:', d2?.reduce((a, b) => a + (b.alarm_count || 0), 0));
}

check();
