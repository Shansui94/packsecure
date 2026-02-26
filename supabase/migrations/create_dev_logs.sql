-- ============================================================
-- DEV LOGS TABLE
-- Stores daily AI-generated development activity reports
-- ============================================================

CREATE TABLE IF NOT EXISTS dev_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date     date NOT NULL UNIQUE,          -- One report per day
    summary         text,                          -- AI-generated summary (Bahasa/English mix)
    commits_json    jsonb DEFAULT '[]',            -- Array of {hash, message, author, files_changed}
    metrics_json    jsonb DEFAULT '{}',            -- App metrics: {trips_created, active_users, ...}
    changes_json    jsonb DEFAULT '[]',            -- Structured changes list from AI
    risks_json      jsonb DEFAULT '[]',            -- Risk items identified by AI
    recommendations jsonb DEFAULT '[]',            -- AI recommendations
    raw_ai_response text,                          -- Full raw Gemini response (for debugging)
    created_at      timestamptz DEFAULT now()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_dev_logs_report_date ON dev_logs(report_date DESC);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE dev_logs ENABLE ROW LEVEL SECURITY;

-- Only SuperAdmin and Admin can read
CREATE POLICY "dev_logs_read" ON dev_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users_public
            WHERE id = auth.uid()
              AND role IN ('SuperAdmin', 'Admin')
        )
    );

-- Only service role can insert (GitHub Actions uses service key)
CREATE POLICY "dev_logs_insert_service" ON dev_logs
    FOR INSERT
    WITH CHECK (true);  -- service role bypasses RLS anyway

-- Allow upsert on conflict (re-run same day)
CREATE POLICY "dev_logs_update_service" ON dev_logs
    FOR UPDATE
    USING (true);
