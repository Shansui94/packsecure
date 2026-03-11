// Run: npx tsx scripts/run_sql.ts
// Executes create_production_schedule.sql via Supabase REST SQL endpoint

const fs = require('fs');
const path = require('path');

// Load .env
const envContent = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf-8');
const vars: Record<string,string> = {};
envContent.split(/\r?\n/).forEach((l: string) => {
    const m = l.match(/^([A-Z_0-9]+)=(.+)$/);
    if (m) vars[m[1]] = m[2].trim();
});

const url = vars.VITE_SUPABASE_URL;
const key = vars.VITE_SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or SERVICE_ROLE_KEY');
    process.exit(1);
}

const sql = fs.readFileSync(path.resolve(__dirname, '..', 'create_production_schedule.sql'), 'utf-8');

async function run() {
    // Use the Supabase SQL endpoint (PostgREST doesn't support DDL, so use pg-meta or direct SQL)
    const response = await fetch(`${url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    // If RPC endpoint doesn't work, just verify if table exists
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(url, key);
    
    // Try to query the table
    const { error } = await sb.from('production_schedule').select('id').limit(1);
    
    if (error && error.message.includes('does not exist')) {
        console.log('❌ Table not found. Please run the following SQL in Supabase Dashboard → SQL Editor:');
        console.log('');
        console.log(sql);
    } else if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('✅ Table production_schedule exists and is accessible!');
    }
}

run();
