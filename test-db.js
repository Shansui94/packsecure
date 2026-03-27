import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data } = await supabase.from('sales_orders').select('*').limit(1);
    if(data && data.length) {
        console.log(Object.keys(data[0]).join('\n'));
    }
}
run();
