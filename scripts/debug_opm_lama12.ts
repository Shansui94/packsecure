import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: stock, error } = await supabase.from('v2_inventory_view')
        .select('*')
        .eq('loc_id', 'OPM Lama')
        .limit(1);
        
    console.log("View row 1:", stock?.[0]);
}
main();
