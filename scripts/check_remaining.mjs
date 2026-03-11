import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
readFileSync('.env', 'utf8').split('\n').forEach(l => {
    const eq = l.indexOf('=');
    if (eq > 0 && !l.startsWith('#')) env[l.slice(0, eq).trim()] = l.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: pub } = await supabase.from('users_public').select('name,email,employee_id,role');
const { data: sys } = await supabase.from('sys_users_v2').select('employee_id');
const sSet = new Set((sys || []).map(u => u.employee_id));
const missing = (pub || []).filter(u => !sSet.has(u.employee_id));
console.log('Remaining missing (' + missing.length + '):');
for (const m of missing) {
    console.log(m.employee_id + ' | ' + m.name + ' | ' + m.role);
}
