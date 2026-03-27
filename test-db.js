import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: yashin } = await supabase.from('users_public').select('id').ilike('name', '%Yashin%').single();
    const { data: trips } = await supabase.from('sales_orders').select('status, pod_timestamp, created_at').eq('driver_id', yashin.id).order('created_at', {ascending: false}).limit(5);
    console.dir(trips, {depth: null});
}
run();
