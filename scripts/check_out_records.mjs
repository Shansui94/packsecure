import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const anonKeyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const key = serviceKeyMatch ? serviceKeyMatch[1].trim() : anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, key);

async function check() {
    console.log("Checking recent stock OUT entries...");
    const { data: stockData, error } = await supabase.from('stock_ledger_v2').select('*')
        .lt('change_qty', 0)
        .order('timestamp', { ascending: false }).limit(20);
    
    if (error) console.error(error);
    
    // summarize the data briefly
    const summary = (stockData || []).map(r => ({
        timestamp: r.timestamp,
        sku: r.sku,
        loc: r.loc_id,
        qty: r.change_qty,
        doc: r.ref_doc
    }));
    
    console.dir(summary, { depth: null });
}
check();
