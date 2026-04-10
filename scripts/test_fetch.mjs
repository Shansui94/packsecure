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
    const data = await res.json();
    console.log(data);
}
run();
