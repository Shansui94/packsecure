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
    const res = await fetch(`${supabaseUrl}/rest/v1/master_items_v2?select=sku,name,nickname,status`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await res.json();
    fs.writeFileSync('all_v2_items.json', JSON.stringify(data, null, 2), 'utf-8');
    console.log('Saved to all_v2_items.json. Length:', data.length);
}
run();
