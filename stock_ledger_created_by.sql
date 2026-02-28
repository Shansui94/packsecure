-- Add created_by tracking columns to stock_ledger_v2
ALTER TABLE public.stock_ledger_v2
  ADD COLUMN IF NOT EXISTS created_by      TEXT,       -- auth user uid
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;       -- display name for quick reads

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'stock_ledger_v2'
  AND column_name IN ('created_by', 'created_by_name');
