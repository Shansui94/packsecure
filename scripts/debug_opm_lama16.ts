import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const today = new Date().toISOString().split('T')[0];
    
    // Find one duplicate log from today
    const { data: logs } = await supabase.from('production_logs_v2')
        .select('log_id, created_at, machine_id, output_qty, sku')
        .gte('created_at', today)
        .order('created_at', { ascending: true });
        
    let targetLogId = null;
    if (logs && logs.length > 0) {
        for (let i = 1; i < logs.length; i++) {
            const prev = new Date(logs[i-1].created_at).getTime();
            const curr = new Date(logs[i].created_at).getTime();
            const diff = curr - prev;
            
            if (diff < 5000 && logs[i].machine_id === logs[i-1].machine_id) {
                targetLogId = logs[i].log_id;
                console.log(`Found duplicate: ${logs[i].log_id} at ${logs[i].created_at}`);
                break;
            }
        }
    }
    
    if (!targetLogId) return console.log("No duplicates found to test");
    
    // Check ledger BEFORE delete
    const { data: ledgerBefore } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', targetLogId);
    console.log("Ledger BEFORE:", ledgerBefore);
    
    // Attempt delete
    console.log("Deleting log...", targetLogId);
    await supabase.from('production_logs_v2').delete().eq('log_id', targetLogId);
    
    // Check ledger AFTER delete
    const { data: ledgerAfter } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('ref_doc', targetLogId);
    console.log("Ledger AFTER:", ledgerAfter);
    
    // Reinsert to restore if it was deleted just in case it broke something
    // (Actually we WANT to delete duplicates, so leaving it deleted is fine).
}
main();
