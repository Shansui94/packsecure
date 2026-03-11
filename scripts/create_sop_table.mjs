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

// Use the Supabase Management API to run SQL  
// First, extract project ref from URL
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
console.log('Project ref:', projectRef);

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Use rpc to execute raw SQL (need pg_net or a custom function)
// Alternative: use the postgrest approach - create via supabase-js with service role
// Actually, let's just use the SQL editor REST endpoint
const sql = `
CREATE TABLE IF NOT EXISTS public.sop_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text DEFAULT '',
    content text DEFAULT '',
    video_url text DEFAULT '',
    page_id text DEFAULT '',
    target_roles text[] DEFAULT '{}',
    sort_order int DEFAULT 0,
    is_published boolean DEFAULT true,
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sop_articles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sop_read_published' AND tablename = 'sop_articles') THEN
        CREATE POLICY sop_read_published ON public.sop_articles FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sop_service_all' AND tablename = 'sop_articles') THEN
        CREATE POLICY sop_service_all ON public.sop_articles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

// Try via pg_query RPC (some Supabase projects have this)
const { data, error } = await supabase.rpc('exec_sql', { query: sql });
if (error) {
    console.log('RPC exec_sql not available:', error.message);
    console.log('\nTrying alternative: direct REST SQL endpoint...');

    // Try the /pg endpoint (Supabase v2 SQL API)  
    const sqlResp = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    if (sqlResp.ok) {
        console.log('✅ Table created via /pg/query!');
    } else {
        const errText = await sqlResp.text();
        console.log(`/pg/query failed (${sqlResp.status}):`, errText.substring(0, 200));
        console.log('\n⚠️ Please run this SQL in Supabase Dashboard → SQL Editor:');
        console.log(sql);
    }
} else {
    console.log('✅ Table created via RPC!');
}
