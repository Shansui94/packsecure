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

// Use the Supabase pg REST endpoint (available in newer Supabase)
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

const sql = `
CREATE TABLE IF NOT EXISTS public.sop_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text DEFAULT '',
    content text DEFAULT '',
    video_url text DEFAULT '',
    page_id text DEFAULT '',
    target_roles text[] DEFAULT ARRAY[]::text[],
    sort_order int DEFAULT 0,
    is_published boolean DEFAULT true,
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
`;

const rls = `ALTER TABLE public.sop_articles ENABLE ROW LEVEL SECURITY;`;
const policy1 = `CREATE POLICY IF NOT EXISTS sop_read_all ON public.sop_articles FOR SELECT USING (true);`;
const policy2 = `CREATE POLICY IF NOT EXISTS sop_write_all ON public.sop_articles FOR INSERT WITH CHECK (true);`;
const policy3 = `CREATE POLICY IF NOT EXISTS sop_update_all ON public.sop_articles FOR UPDATE USING (true) WITH CHECK (true);`;
const policy4 = `CREATE POLICY IF NOT EXISTS sop_delete_all ON public.sop_articles FOR DELETE USING (true);`;

// Try the direct postgres connection via supabase-js 
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'public' }
});

// Method: Use PostgREST's ability to call pg functions
// Create a temporary function to run our DDL
const createFnSql = `
CREATE OR REPLACE FUNCTION create_sop_table() RETURNS void AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.sop_articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        description text DEFAULT '',
        content text DEFAULT '',
        video_url text DEFAULT '',
        page_id text DEFAULT '',
        target_roles text[] DEFAULT ARRAY[]::text[],
        sort_order int DEFAULT 0,
        is_published boolean DEFAULT true,
        created_by text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE public.sop_articles ENABLE ROW LEVEL SECURITY;
    BEGIN
        CREATE POLICY sop_read_all ON public.sop_articles FOR SELECT USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY sop_write_all ON public.sop_articles FOR INSERT WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY sop_update_all ON public.sop_articles FOR UPDATE USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        CREATE POLICY sop_delete_all ON public.sop_articles FOR DELETE USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Step 1: Try to call the function if it already exists
let { data, error } = await supabase.rpc('create_sop_table');
if (error) {
    console.log('Function does not exist yet. Need to create it via SQL.');
    console.log('Error:', error.message);

    // Try via the SQL API endpoint available on newer Supabase
    // https://supabase.com/docs/guides/database/sql
    const endpoints = [
        `${SUPABASE_URL}/pg/query`,
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    ];

    let created = false;
    for (const ep of endpoints) {
        try {
            const resp = await fetch(ep, {
                method: 'POST',
                headers: {
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: createFnSql })
            });
            if (resp.ok) {
                console.log(`✅ Function created via ${ep}!`);
                // Now call it
                const { error: callErr } = await supabase.rpc('create_sop_table');
                if (!callErr) {
                    console.log('✅ Table created successfully!');
                    created = true;
                } else {
                    console.log('Function call error:', callErr.message);
                }
                break;
            }
        } catch (e) { }
    }

    if (!created) {
        // Last resort: write SQL file for user to run
        console.log('\n⚠️ Could not auto-create table. Please run this SQL in Supabase Dashboard:');
        console.log(createFnSql);
        console.log('\nThen run: SELECT create_sop_table();');
    }
} else {
    console.log('✅ Table created successfully!');
}

// Verify
const { data: check, error: checkErr } = await supabase.from('sop_articles').select('id').limit(1);
if (checkErr) {
    console.log('\n❌ Table verification failed:', checkErr.message);
} else {
    console.log('\n✅ Table verified! Rows:', check?.length || 0);
}
