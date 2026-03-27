--  ====================================================================
--  FINAL DEPRECATION SCRIPT: DROP V1 TABLES
--  ====================================================================
--  WARNING: This script will PERMANENTLY delete the legacy tables.
--  Only execute this after verifying that all dashboards and hardware 
--  are running perfectly on V2.
--  ====================================================================

-- 1. Drop the legacy unified view (so it doesn't block the table drops)
DROP VIEW IF EXISTS public.v_production_logs_unified CASCADE;

-- 2. Drop the legacy production logs (V1)
DROP TABLE IF EXISTS public.production_logs CASCADE;

-- 3. Drop the legacy stock ledger (V1)
DROP TABLE IF EXISTS public.stock_ledger CASCADE;

-- 4. Drop the legacy inventory table (V1, if no longer used)
DROP TABLE IF EXISTS public.inventory CASCADE;

-- Note: CASCADE ensures any remaining triggers or references linked 
-- to these tables are also automatically deleted.
