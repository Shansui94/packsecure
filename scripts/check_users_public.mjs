// check_users_public.mjs - Find why users_public lookup fails for khailoon94
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
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const TARGET_EMAIL = 'khailoon94@gmail.com';

// Get auth UUID
const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
const authData = await authResp.json();
const targetUser = (authData.users || []).find(u => u.email === TARGET_EMAIL);
if (!targetUser) { console.error('User not found in auth'); process.exit(1); }
const uuid = targetUser.id;
console.log(`Auth UUID for ${TARGET_EMAIL}: ${uuid}`);

// Check sys_users_v2 directly with service key
const sysResp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?auth_user_id=eq.${uuid}&select=*`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
const sysData = await sysResp.json();
console.log(`sys_users_v2 record:`, JSON.stringify(sysData));

// Check users_public with service key
const pubResp = await fetch(`${SUPABASE_URL}/rest/v1/users_public?id=eq.${uuid}&select=*`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
const pubData = await pubResp.json();
console.log(`users_public (service key):`, JSON.stringify(pubData));

// Check users_public with ANON key (simulates what the browser does)
const anonResp = await fetch(`${SUPABASE_URL}/rest/v1/users_public?id=eq.${uuid}&select=*`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
});
const anonData = await anonResp.json();
console.log(`users_public (anon key / browser):`, JSON.stringify(anonData));
