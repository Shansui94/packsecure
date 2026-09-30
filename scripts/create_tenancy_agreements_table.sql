-- ========================================================
-- Table: tenancy_agreements
-- Purpose: Packsecure OS Tenancy Agreements & Lease Repository
-- ========================================================

CREATE TABLE IF NOT EXISTS public.tenancy_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    property_address TEXT,
    location_tag TEXT,
    landlord_name TEXT,
    landlord_phone TEXT,
    landlord_ic_ssm TEXT,
    start_date DATE,
    end_date DATE,
    monthly_rent NUMERIC(12, 2) DEFAULT 0,
    security_deposit NUMERIC(12, 2) DEFAULT 0,
    utility_deposit NUMERIC(12, 2) DEFAULT 0,
    notice_period_months INTEGER DEFAULT 2,
    status TEXT DEFAULT 'Active',
    file_url TEXT,
    storage_path TEXT,
    file_name TEXT,
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    whatsapp_reminded_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on end_date and status for rapid expiry tracking
CREATE INDEX IF NOT EXISTS idx_tenancy_end_date ON public.tenancy_agreements(end_date);
CREATE INDEX IF NOT EXISTS idx_tenancy_status ON public.tenancy_agreements(status);

-- RLS
ALTER TABLE public.tenancy_agreements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenancy_agreements' AND policyname = 'Allow authenticated read tenancy_agreements'
    ) THEN
        CREATE POLICY "Allow authenticated read tenancy_agreements"
        ON public.tenancy_agreements FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenancy_agreements' AND policyname = 'Allow authenticated modify tenancy_agreements'
    ) THEN
        CREATE POLICY "Allow authenticated modify tenancy_agreements"
        ON public.tenancy_agreements FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenancy_agreements' AND policyname = 'Allow anon all tenancy_agreements'
    ) THEN
        CREATE POLICY "Allow anon all tenancy_agreements"
        ON public.tenancy_agreements FOR ALL
        TO anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
