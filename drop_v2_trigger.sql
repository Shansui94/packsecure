-- REMOVE POISON PILL
-- Run this in Supabase SQL Editor

-- 1. Just drop the trigger on production_logs_v2 that is crashing the system.
--    This ensures V1 can successfully receive data and trigger V1->V2 copies
--    without crashing the whole pipeline.
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;

-- 2. Leave distribute_production_to_ledger exactly as it is (it successfully handles V1 -> stock ledger)
