import { readFileSync, writeFileSync } from 'fs';
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

const lines = [];
lines.push('AUDIT RESULTS');
lines.push('=============');
lines.push('');

// Check users_public not in sys_users_v2
lines.push('[A] In users_public but NOT in sys_users_v2 (CANNOT LOGIN):');
let countA = 0;
for (const pub of (pubUsers || [])) {
    if (!sysMap.has(pub.employee_id)) {
        const auth = authEmailMap.has(pub.email);
        lines.push(`  ${pub.employee_id} | ${pub.name} | ${pub.role} | auth:${auth ? 'Y' : 'N'}`);
        countA++;
    }
}
if (countA === 0) lines.push('  (none)');

// Check sys_users_v2 without auth_user_id
lines.push('');
lines.push('[B] In sys_users_v2 but NO auth_user_id linked:');
let countB = 0;
for (const sys of (sysUsers || [])) {
    if (!sys.auth_user_id) {
        const auth = authEmailMap.has(sys.email);
        lines.push(`  ${sys.employee_id} | ${sys.name} | ${sys.role} | auth:${auth ? 'Y' : 'N'}`);
        countB++;
    }
}
if (countB === 0) lines.push('  (none)');

// Check sys_users_v2 without Supabase Auth
lines.push('');
lines.push('[C] In sys_users_v2 but NO Supabase Auth account:');
let countC = 0;
for (const sys of (sysUsers || [])) {
    if (!authEmailMap.has(sys.email)) {
        lines.push(`  ${sys.employee_id} | ${sys.name} | ${sys.role}`);
        countC++;
    }
}
if (countC === 0) lines.push('  (none)');

lines.push('');
lines.push(`TOTALS: pub=${(pubUsers || []).length} sys=${(sysUsers || []).length} auth=${authUsers.length}`);
lines.push(`ISSUES: A=${countA} B=${countB} C=${countC}`);

const output = lines.join('\n');
writeFileSync('/tmp/audit.txt', output, 'utf8');
console.log(output);
