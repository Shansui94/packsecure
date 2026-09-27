import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS public.issue_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(64) UNIQUE NOT NULL,
    source_group_id TEXT,
    source_type VARCHAR(32) NOT NULL DEFAULT 'whatsapp_group',
    sender_name VARCHAR(128),
    sender_phone VARCHAR(64),
    employee_id VARCHAR(64),
    raw_content TEXT NOT NULL,
    photo_url TEXT,
    entities JSONB DEFAULT '{}'::jsonb,
    ai_diagnosis TEXT,
    severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'pending_triage',
    option_1_action JSONB DEFAULT '{}'::jsonb,
    option_2_reply TEXT,
    option_3_bug JSONB DEFAULT '{}'::jsonb,
    resolved_by VARCHAR(128),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'issue_tickets' AND policyname = 'issue_tickets_all_access') THEN
        CREATE POLICY "issue_tickets_all_access" ON public.issue_tickets FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

async function main() {
  console.log("1. Attempting /pg/query...");
  const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'X-Connection-Encrypted': 'true'
    },
    body: JSON.stringify({ query: sql })
  });

  if (resp.ok) {
    console.log("✅ Success via /pg/query!");
  } else {
    console.log(`❌ /pg/query returned ${resp.status}`);
    console.log("2. Attempting RPC exec_sql...");
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql_query: sql, query: sql })
    });
    if (r2.ok) {
      console.log("✅ Success via RPC exec_sql!");
    } else {
      console.log(`❌ RPC returned ${r2.status}`);
    }
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb.from('issue_tickets').select('*').limit(1);
  if (error) {
    console.log("❌ Table 'issue_tickets' verification failed:", error.message);
  } else {
    console.log("🎉 Table 'issue_tickets' is VERIFIED and READY! Current count:", data.length);
  }
}

main().catch(console.error);
