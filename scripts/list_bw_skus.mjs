import { readFileSync } from 'fs';
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
}
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const resp = await fetch(`${SUPABASE_URL}/rest/v1/master_items_v2?sku=like.BW*&select=sku,name,type,uom&order=sku.asc&limit=100`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
const data = await resp.json();
console.log(`Found ${data.length} BW items:`);
data.forEach(i => console.log(`  ${i.sku} | ${i.name}`));
