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

// 1. Find bob (employee_id=6965)
const resp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?employee_id=eq.6965&select=id,name,role,employee_id,allowed_pages`, { headers });
const users = await resp.json();
console.log('Bob:', JSON.stringify(users, null, 2));

// 2. Check what the stock movement page is called in the system
const navResp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?select=id,name,allowed_pages&limit=3`, { headers });
const samples = await navResp.json();
console.log('\nSample users with allowed_pages:', JSON.stringify(samples, null, 2));
