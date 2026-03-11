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

// 1. Bob's role
const r1 = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?employee_id=eq.6965&select=id,name,role,employee_id`, { headers });
const bob = await r1.json();
console.log('Bob:', JSON.stringify(bob));

// 2. All role_permissions
const r2 = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions?select=*&order=role_name,page_id`, { headers });
const perms = await r2.json();
console.log('\nAll role_permissions:', JSON.stringify(perms, null, 2));

// 3. Find stock-movement nav items in Layout
// Already know it's NavItem id-based. Let's grep for the Stock Movement id
