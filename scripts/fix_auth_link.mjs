// fix_auth_link.mjs - Link khailoon94@gmail.com auth UUID to sys_users_v2
import { readFileSync } from 'fs';

// Read .env manually
const envContent = readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = val;
    }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAIL = 'khailoon94@gmail.com';
const TARGET_EMPLOYEE_ID = '8335';

console.log('Supabase URL:', SUPABASE_URL?.slice(0, 40));

// Step 1: Get auth user UUID for the target email
const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
    }
});
const authData = await authResp.json();
const users = authData.users || [];
console.log(`Total auth users: ${users.length}`);

const targetUser = users.find(u => u.email === TARGET_EMAIL);
if (!targetUser) {
    console.error(`❌ Could not find auth user: ${TARGET_EMAIL}`);
    console.log('Available emails:', users.map(u => u.email).join(', '));
    process.exit(1);
}
console.log(`✅ Found auth user: ${targetUser.email} → UUID: ${targetUser.id}`);

// Step 2: Check current sys_users_v2 record for this employee
const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?employee_id=eq.${TARGET_EMPLOYEE_ID}&select=id,name,role,auth_user_id`, {
    headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json'
    }
});
const sysUsers = await checkResp.json();
console.log(`sys_users_v2 records for employee_id ${TARGET_EMPLOYEE_ID}:`, JSON.stringify(sysUsers));

if (!sysUsers || sysUsers.length === 0) {
    console.error(`❌ No sys_users_v2 record found with employee_id = ${TARGET_EMPLOYEE_ID}`);
    process.exit(1);
}

const sysUser = sysUsers[0];
console.log(`Current auth_user_id: ${sysUser.auth_user_id}`);

if (sysUser.auth_user_id === targetUser.id) {
    console.log('✅ auth_user_id already correct! No update needed.');
    process.exit(0);
}

// Step 3: Update auth_user_id
const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/sys_users_v2?id=eq.${sysUser.id}`, {
    method: 'PATCH',
    headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    },
    body: JSON.stringify({ auth_user_id: targetUser.id })
});

if (updateResp.ok) {
    const updated = await updateResp.json();
    console.log(`✅ Updated auth_user_id for ${sysUser.name} (employee ${TARGET_EMPLOYEE_ID})`);
    console.log('   New auth_user_id:', updated[0]?.auth_user_id);
} else {
    const err = await updateResp.text();
    console.error(`❌ Update failed: ${err}`);
}
