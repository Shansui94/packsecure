/**
 * Apply LogisticsCoordinator role_permissions and assign Vivian (optional email in VIVIAN_EMAIL).
 * Usage: node scripts/db_ops/apply_logistics_coordinator.mjs
 * Requires .env with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
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
const VIVIAN_EMAIL = process.env.VIVIAN_EMAIL || 'diyadmin1111@gmail.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
};

const PAGES = [
    'profile', 'construction', 'dashboard', 'livestock', 'delivery', 'order-summary',
    'products', 'maintenance', 'driver-management', 'leave-calendar', 'personal-report', 'activity-logs',
];

console.log('--- Upserting LogisticsCoordinator role_permissions ---');
for (const page_id of PAGES) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ role_name: 'LogisticsCoordinator', page_id, allowed: true }),
    });
    if (resp.status === 201 || resp.status === 200 || resp.status === 409) {
        console.log(`  OK ${page_id}`);
    } else {
        console.log(`  FAIL ${page_id}:`, resp.status, (await resp.text()).slice(0, 120));
    }
}

async function patchRole(table, email) {
    const q = `${SUPABASE_URL}/rest/v1/${table}?email=eq.${encodeURIComponent(email)}`;
    const resp = await fetch(q, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ role: 'LogisticsCoordinator' }),
    });
    const data = await resp.json().catch(() => []);
    return { table, status: resp.status, count: Array.isArray(data) ? data.length : 0, data };
}

console.log(`\n--- Setting role LogisticsCoordinator for ${VIVIAN_EMAIL} ---`);
for (const table of ['users_public', 'sys_users_v2']) {
    const r = await patchRole(table, VIVIAN_EMAIL);
    console.log(`  ${table}: HTTP ${r.status}, updated ${r.count} row(s)`);
    if (r.count > 0) console.log('   ', r.data[0]?.name, r.data[0]?.role);
}

console.log('\nDone. User should log out and log in again.');
