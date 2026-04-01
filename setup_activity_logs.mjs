import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Because the user_id from frontend \`user.uid\` might be random for demo accounts,
-- we don't strictly enforce foreign key to auth.users. But we use it for filtering.

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Insert Policy (Anyone logged in can insert)
DO $$ BEGIN
    CREATE POLICY "Allow authenticated insert logs" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow anon insert logs" ON public.user_activity_logs FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. Select Policy (Users can see their own)
DO $$ BEGIN
    CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs FOR SELECT USING (auth.uid()::text = user_id::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Select Policy (SuperAdmin sees all)
DO $$ BEGIN
    CREATE POLICY "SuperAdmin can view all activity logs" ON public.user_activity_logs FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sys_users_v2 WHERE auth_user_id = auth.uid() AND role = 'SuperAdmin'
        )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
`;

async function run() {
    console.log("Creating user_activity_logs table...");
    // Since we don't have exec_sql easily via JS client, we will use a workaround:
    // Calling a known RPC or just creating it directly via psql, but we can't easily.
    // Let's use standard REST. Oh wait, we can't run raw DDL via supabase-js REST.
    // I should create a file `setup_activity_logs.sql` and give the user the PSQL command, OR if the project has direct DB connection string we can use postgres package.
    
}
run();
