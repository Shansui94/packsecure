import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
readFileSync('.env', 'utf8').split('\n').forEach(l => {
    const eq = l.indexOf('=');
    if (eq > 0 && !l.startsWith('#')) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: pubUsers } = await supabase.from('users_public').select('name, email, employee_id, role, status');
const { data: sysUsers } = await supabase.from('sys_users_v2').select('name, email, employee_id, role, auth_user_id');
const { data: authData } = await supabase.auth.admin.listUsers();
const authUsers = authData?.users || [];

const sysMap = new Map((sysUsers || []).map(u => [u.employee_id, u]));
const authEmailMap = new Map(authUsers.map(u => [u.email, u]));

let fixed = 0, skipped = 0, errors = 0;

// === FIX A: users_public without sys_users_v2 ===
for (const pub of (pubUsers || [])) {
    if (!pub.employee_id || !pub.name || pub.name === 'null') { skipped++; continue; }
    if (sysMap.has(pub.employee_id)) continue; // already in sys_users_v2

    console.log(`[A] Fixing ${pub.employee_id} | ${pub.name} | ${pub.role}`);

    // Step 1: Create/find Auth account
    let authUid = null;
    const existingAuth = authEmailMap.get(pub.email);
    if (existingAuth) {
        authUid = existingAuth.id;
        // Reset password to employeeID + 00
        const { error: pwErr } = await supabase.auth.admin.updateUserById(authUid, { password: pub.employee_id + '00' });
        if (pwErr) console.log(`  ⚠️ PWD reset failed: ${pwErr.message}`);
        else console.log(`  ✅ Password reset to ${pub.employee_id}00`);
    } else {
        // Create auth account
        const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
            email: pub.email,
            password: pub.employee_id + '00',
            email_confirm: true,
            user_metadata: { name: pub.name, role: pub.role, employee_id: pub.employee_id }
        });
        if (authErr) {
            console.log(`  ❌ Auth create failed: ${authErr.message}`);
            errors++;
            continue;
        }
        authUid = newAuth.user.id;
        console.log(`  ✅ Auth account created`);
    }

    // Step 2: Create sys_users_v2 entry
    const { error: sysErr } = await supabase.from('sys_users_v2').insert({
        name: pub.name,
        email: pub.email,
        employee_id: pub.employee_id,
        role: pub.role,
        pin_code: pub.employee_id,
        auth_user_id: authUid
    });
    if (sysErr) {
        console.log(`  ❌ sys_users_v2 insert failed: ${sysErr.message}`);
        errors++;
    } else {
        console.log(`  ✅ sys_users_v2 created`);
        fixed++;
    }
}

// === FIX B: sys_users_v2 without auth_user_id ===
for (const sys of (sysUsers || [])) {
    if (sys.auth_user_id) continue;
    if (!sys.email) { skipped++; continue; }

    console.log(`[B] Linking ${sys.employee_id} | ${sys.name}`);
    const existingAuth = authEmailMap.get(sys.email);
    if (existingAuth) {
        const { error } = await supabase.from('sys_users_v2').update({ auth_user_id: existingAuth.id }).eq('employee_id', sys.employee_id);
        if (error) { console.log(`  ❌ Link failed: ${error.message}`); errors++; }
        else { console.log(`  ✅ Linked auth_user_id`); fixed++; }
    } else {
        // Create auth
        const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
            email: sys.email,
            password: sys.employee_id + '00',
            email_confirm: true,
            user_metadata: { name: sys.name, role: sys.role, employee_id: sys.employee_id }
        });
        if (authErr) { console.log(`  ❌ Auth create failed: ${authErr.message}`); errors++; continue; }
        const { error } = await supabase.from('sys_users_v2').update({ auth_user_id: newAuth.user.id }).eq('employee_id', sys.employee_id);
        if (error) { console.log(`  ❌ Link failed: ${error.message}`); errors++; }
        else { console.log(`  ✅ Auth created + linked`); fixed++; }
    }
}

// === FIX C: sys_users_v2 without Auth account ===
for (const sys of (sysUsers || [])) {
    if (!sys.email || authEmailMap.has(sys.email)) continue;
    // Already handled in B if auth_user_id was missing

    console.log(`[C] Creating Auth for ${sys.employee_id} | ${sys.name}`);
    const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
        email: sys.email,
        password: sys.employee_id + '00',
        email_confirm: true,
        user_metadata: { name: sys.name, role: sys.role, employee_id: sys.employee_id }
    });
    if (authErr) { console.log(`  ❌ ${authErr.message}`); errors++; continue; }
    const { error } = await supabase.from('sys_users_v2').update({ auth_user_id: newAuth.user.id }).eq('employee_id', sys.employee_id);
    if (error) console.log(`  ⚠️ Link failed: ${error.message}`);
    else { console.log(`  ✅ Auth created + linked`); fixed++; }
}

console.log(`\nDONE: fixed=${fixed} skipped=${skipped} errors=${errors}`);
