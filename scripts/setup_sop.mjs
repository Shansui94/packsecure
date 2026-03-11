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
const headers = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// 1. Create sop_articles table via SQL
const sqlResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
});

// Use raw SQL via the management API
const sql = `
CREATE TABLE IF NOT EXISTS sop_articles (
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

-- Enable RLS
ALTER TABLE sop_articles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read published articles
CREATE POLICY IF NOT EXISTS "Anyone can read published SOPs" ON sop_articles
    FOR SELECT USING (is_published = true);

-- Allow service role full access (for admin operations via service key)
CREATE POLICY IF NOT EXISTS "Service role full access" ON sop_articles
    FOR ALL USING (true) WITH CHECK (true);
`;

// Execute via Supabase SQL endpoint (management API)
// Actually, let's use the supabase-js client instead
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Try creating via rpc if available, otherwise just test if table exists
const { data: testData, error: testErr } = await supabase.from('sop_articles').select('id').limit(1);
if (testErr && testErr.code === '42P01') {
    console.log('Table does not exist yet. Please run the SQL in Supabase Dashboard.');
    console.log('\n--- SQL TO RUN ---');
    console.log(sql);
} else if (testErr) {
    console.log('Table might not exist. Error:', testErr.message);
    console.log('\n--- SQL TO RUN ---');
    console.log(sql);
} else {
    console.log('✅ sop_articles table already exists!');
    console.log('Current rows:', testData?.length || 0);
}

// 2. Check/create storage bucket
const bucketResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket/sop-videos`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
});
if (bucketResp.ok) {
    console.log('\n✅ sop-videos bucket already exists!');
} else {
    console.log('\nCreating sop-videos bucket...');
    const createResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: 'sop-videos',
            name: 'sop-videos',
            public: true,
            file_size_limit: 52428800, // 50MB
            allowed_mime_types: ['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
        })
    });
    const result = await createResp.json();
    console.log('Bucket creation result:', JSON.stringify(result));
}
