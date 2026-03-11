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

// Bob's role only
const r1 = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?employee_id=eq.6965&select=name,role`, { headers });
console.log('Bob:', JSON.stringify(await r1.json()));

// Role permissions for Bob's role
const r2 = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions?select=role_name,page_id,allowed&order=role_name,page_id`, { headers });
const perms = await r2.json();
console.log('\nAll permissions:');
if (Array.isArray(perms)) {
    perms.forEach(p => console.log(`  ${p.role_name} | ${p.page_id} | ${p.allowed}`));
} else {
    console.log(JSON.stringify(perms));
}
