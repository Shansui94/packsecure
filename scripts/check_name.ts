import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    let res2 = await supabase
        .from('master_items_v2')
        .select('sku, name')
        .eq('sku', 'BW-SL-BLK-100Mx100CMx1ROLL-GRN');

    console.log(JSON.stringify(res2.data, null, 2));
}

run();
