import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    let { data, error } = await supabase
        .from('master_items_v2')
        .select('sku, name, created_at')
        .ilike('name', '%AUTO-REG%');
        
    let res2 = await supabase
        .from('master_items_v2')
        .select('sku, name, created_at')
        .in('sku', ['BW-SL-CLR-100Mx100CMx1ROLL-GRN', 'BW-SL-CLR-100Mx100CMx1ROLL-RED', 'BW-SL-BLK-100Mx100CMx1ROLL-RED']);

    const output = {
        autoreg: data,
        specific: res2.data
    };
    fs.writeFileSync('skus_out.json', JSON.stringify(output, null, 2), 'utf8');
}

run();
