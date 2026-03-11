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
const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// All pages bob should see
const pages = ['delivery-driver', 'delivery-history', 'driver-leave', 'lorry-service', 'notes', 'tasks', 'leave-calendar', 'stock-movement'];

for (const p of pages) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ role_name: 'Driver', page_id: p, allowed: true })
    });
    const status = resp.status;
    if (status === 201) {
        console.log(`✅ Added: ${p}`);
    } else if (status === 409) {
        console.log(`⏭️ Already exists: ${p}`);
    } else {
        const text = await resp.text();
        console.log(`❓ ${p}: status=${status} ${text.substring(0, 100)}`);
    }
}

// Verify final state
const r = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions?role_name=eq.Driver&select=page_id,allowed&order=page_id`, { headers });
const final = await r.json();
console.log('\nFinal Driver permissions:', JSON.stringify(final));
