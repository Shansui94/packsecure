import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    let { data: d1 } = await supabase.from('machine_active_products').select('*').limit(1);
    console.log("machine_active_products:", d1 && d1.length > 0 ? Object.keys(d1[0]) : "empty");

    let { data: d2 } = await supabase.from('production_logs_v2').select('*').limit(1);
    console.log("production_logs_v2:", d2 && d2.length > 0 ? Object.keys(d2[0]) : "empty");
}
main();
