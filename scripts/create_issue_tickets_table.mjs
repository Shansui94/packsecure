import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.kdahubyhwndgyloaljak:%24QNQ4rAW*%23%25294z@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

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
  await client.connect();
  console.log("Connected to Postgres successfully!");
  
  await client.query(sql);
  console.log("Table issue_tickets created / ensured!");

  const res = await client.query("SELECT COUNT(*) FROM public.issue_tickets");
  console.log("Current issue_tickets count:", res.rows[0].count);

  await client.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
