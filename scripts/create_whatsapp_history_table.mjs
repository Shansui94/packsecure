import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.kdahubyhwndgyloaljak:%24QNQ4rAW*%23%25294z@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(128) NOT NULL,
    role VARCHAR(16) NOT NULL,
    sender_name VARCHAR(128),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_history_session_created 
ON public.whatsapp_chat_history(session_id, created_at DESC);

ALTER TABLE public.whatsapp_chat_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_chat_history' AND policyname = 'wa_chat_history_all') THEN
        CREATE POLICY "wa_chat_history_all" ON public.whatsapp_chat_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

async function main() {
  await client.connect();
  console.log("Connected to Postgres successfully!");
  
  await client.query(sql);
  console.log("Table whatsapp_chat_history created / ensured!");

  const res = await client.query("SELECT COUNT(*) FROM public.whatsapp_chat_history");
  console.log("Current whatsapp_chat_history count:", res.rows[0].count);

  await client.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
