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
const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

// Find bob
const resp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?employee_id=eq.6965&select=*`, { headers });
const users = await resp.json();
console.log('Bob:', JSON.stringify(users, null, 2));

// Check role_page_permissions or similar table
const tables = ['role_page_permissions', 'page_permissions', 'user_permissions', 'sys_page_permissions'];
for (const t of tables) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=5`, { headers });
    if (r.ok) {
        const d = await r.json();
        console.log(`\nTable ${t}:`, JSON.stringify(d, null, 2));
    }
}
