-- Add zone_trip_rates table for per-destination trip allowance pricing
CREATE TABLE IF NOT EXISTS public.zone_trip_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name  TEXT NOT NULL UNIQUE,
  rate       NUMERIC NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verify
SELECT * FROM public.zone_trip_rates ORDER BY zone_name;
