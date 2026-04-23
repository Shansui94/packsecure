import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const today = new Date().toISOString().split('T')[0];
    const { data: logs } = await supabase.from('production_logs_v2')
        .select('created_at, machine_id, output_qty, sku')
        .gte('created_at', today)
        .order('created_at', { ascending: true });
        
    console.log(`Total pulses today: ${logs?.length}`);
    
    // Check if there are any duplicate timestamps (within 1-2 seconds)
    let duplicates = 0;
    if (logs && logs.length > 0) {
        for (let i = 1; i < logs.length; i++) {
            const prev = new Date(logs[i-1].created_at).getTime();
            const curr = new Date(logs[i].created_at).getTime();
            const diff = curr - prev;
            
            if (diff < 5000 && logs[i].machine_id === logs[i-1].machine_id) { // Less than 5 seconds
                // console.log(`Possible duplicate: ${logs[i-1].created_at} and ${logs[i].created_at} (${diff}ms apart) on ${logs[i].machine_id}`);
                duplicates++;
            }
        }
    }
    console.log(`Possible duplicates (< 5s apart on same machine): ${duplicates}`);
}
main();
