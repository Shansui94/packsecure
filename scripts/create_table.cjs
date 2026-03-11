// Create production_schedule table via Supabase SQL API
// Run: node scripts/create_table.cjs

const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf-8');
const vars = {};
envContent.split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z_0-9]+)=(.+)$/);
    if (m) vars[m[1]] = m[2].trim();
});

const SUPABASE_URL = vars.VITE_SUPABASE_URL;
const SERVICE_KEY = vars.VITE_SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS production_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    machine_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    target_qty INT NOT NULL DEFAULT 100,
    scheduled_time TIMESTAMPTZ,
    notes TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In-Progress', 'Done', 'Cancelled')),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE production_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_schedule' AND policyname = 'All users can manage production_schedule') THEN
        CREATE POLICY "All users can manage production_schedule" ON production_schedule FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

async function main() {
    // Try the /pg endpoint (Supabase management API for SQL)
    console.log('Attempting to create table via Supabase SQL API...');
    console.log('URL:', SUPABASE_URL.substring(0, 30) + '...');
    
    const response = await fetch(SUPABASE_URL + '/pg/query', {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json',
            'X-Connection-Encrypted': 'true'
        },
        body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
        console.log('pg/query endpoint returned:', response.status);
        // Fallback: try SQL endpoint (different Supabase versions)
        const r2 = await fetch(SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': 'Bearer ' + SERVICE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql_query: sql })
        });
        
        if (!r2.ok) {
            console.log('RPC fallback returned:', r2.status);
            
            // Final check: does table exist?
            const { createClient } = require('@supabase/supabase-js');
            const sb = createClient(SUPABASE_URL, SERVICE_KEY);
            const { error } = await sb.from('production_schedule').select('id').limit(1);
            if (error) {
                console.log('❌ Table does not exist yet.');
                console.log('Please run this SQL in Supabase Dashboard > SQL Editor:');
                console.log(sql);
            } else {
                console.log('✅ Table already exists!');
            }
        } else {
            const result = await r2.json();
            console.log('✅ Table created via RPC:', result);
        }
    } else {
        const result = await response.json();
        console.log('✅ Table created:', result);
    }
}

main().catch(console.error);
