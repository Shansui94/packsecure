-- ============================================================
-- payroll_records: add attendance_bonus column if missing
-- Run this in Supabase SQL Editor
-- ============================================================
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS attendance_bonus NUMERIC DEFAULT 0;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'payroll_records'
ORDER BY ordinal_position;
