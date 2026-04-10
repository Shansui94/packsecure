import * as fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envStr = fs.readFileSync(resolve(__dirname, '../.env'), 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envStr.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function run() {
    const res = await fetch(`${supabaseUrl}/rest/v1/_sku_legacy_map?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const legacy = await res.json();
    
    const res2 = await fetch(`${supabaseUrl}/rest/v1/master_items_v2?select=sku,nickname`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const items = await res2.json();

    for(let l of legacy) {
        const item = items.find(i => i.sku === l.v2_sku);
        if(!item) {
            console.log('Legacy maps to missing item:', l);
        } else if (item.nickname !== l.legacy_sku) {
            console.log(`Legacy mismatch! Map has ${l.legacy_sku} -> ${l.v2_sku}, but master item nickname is: ${item.nickname}`);
        }
    }
}
run();
