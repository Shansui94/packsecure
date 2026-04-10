import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const serviceKeyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const key = serviceKeyMatch[1].trim();
const supabase = createClient(supabaseUrl, key);

async function testInsert() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    const { data, error } = await supabase.from('stock_ledger_v2').insert({
        timestamp: new Date().toISOString(),
        sku: sku,
        change_qty: -1,
        event_type: 'Transfer Out',
        loc_id: 'Unassigned',
        ref_doc: 'TEST_UNASSIGNED'
    }).select();
    
    console.log(error || data);
}
testInsert();
