import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function check() {
    let finalSku = 'MERAH';
    const { data: v2Prod } = await supabase.from('master_items_v2').select('sku').eq('nickname', 'MERAH').maybeSingle();
    if (v2Prod && v2Prod.sku) finalSku = v2Prod.sku;
    
    console.log("Resolved SKU:", finalSku);
}
check();
