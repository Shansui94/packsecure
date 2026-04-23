import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
    const { data, error } = await supabaseAdmin
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Stock In')
        .order('timestamp', { ascending: false })
        .limit(5);
        
    if (error) {
        console.error("Error fetching:", error);
    } else {
        console.log("Latest 5 stock ledger entries:");
        console.table(data);
    }
}
run();
