import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Force load exactly from .env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Restore the survivor to Active
    await supabase.from('master_items_v2').update({ status: 'Active' }).eq('sku', 'BW-DL-BLK-100Mx100CMx1ROLL-RED');
    console.log('Restored survivor to Active');

    // 2. Rename the old obsolete SKU to hide it from confusing the user
    await supabase.from('master_items_v2').update({ name: '[MERGED] DL-HITAM-FULL', status: 'Obsolete' }).eq('sku', 'DL-HITAM-FULL');
    console.log('Renamed old legacy SKU to [MERGED]...');

    // 3. Rename the GRN to [MERGED] as well just in case
    await supabase.from('master_items_v2').update({ name: '[MERGED] DL-HITAM-GRN-ERROR' }).eq('sku', 'BW-DL-BLK-100Mx100CMx1ROLL-GRN');

    const { data } = await supabase.from('master_items_v2').select('sku, name, status').in('sku', ['DL-HITAM-FULL', 'BW-DL-BLK-100Mx100CMx1ROLL-RED', 'BW-DL-BLK-100Mx100CMx1ROLL-GRN']);
    console.log(data);
}
main().catch(console.error);
