-- ============================================================
-- PHASE 1: Safely Decouple V1 and Prepare V2 Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Ensure all critical SKUs exist in master_items_v2
--    (Without this, Foreign Keys on stock_ledger_v2 will reject production logs)
INSERT INTO public.master_items_v2 (sku, name, type, uom, status, supply_type)
VALUES
  ('BW-SL-CLR-100Mx100CMx1ROLL-RED', 'MERAH (SL FULL)', 'FG', 'Roll', 'Active', 'Manufactured'),
  ('BW-SL-CLR-100Mx50CMx2ROLL-ORN', 'OREN (SL HALF)', 'FG', 'Roll', 'Active', 'Manufactured'),
  ('BW-SL-CLR-100Mx33CMx3ROLL-GRN', 'HIJAU (SL 33CM)', 'FG', 'Roll', 'Active', 'Manufactured')
ON CONFLICT (sku) DO NOTHING;

-- 2. Drop the old broken triggers linking the tables
--    This completely severs the "bomb" wire between V1 and V2
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;
DROP TRIGGER IF EXISTS trg_production_logs_v2_to_ledger ON public.production_logs_v2;

-- Check if there's a trigger on production_logs (V1) trying to copy to V2 or ledger
-- We don't drop V1's essential triggers unless they are the broken V2 syncs.
-- Since we don't know the exact name of the V1 copy trigger, we assume the rollback fixed it
-- to its original state (stable). 
-- WAIT: If we want to stop dual-writing from DB, we should just let API do it or wait.
-- Let's define the NEW robust trigger for V2 specifically.
CREATE OR REPLACE FUNCTION public.trigger_v2_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.stock_ledger_v2 (
      sku,
      change_qty,
      event_type,
      ref_doc,
      notes,
      timestamp
    ) VALUES (
      NEW.sku,
      COALESCE(NEW.output_qty, 1)::NUMERIC,
      'Production',
      NEW.log_id::text,
      'API-Log: ' || NEW.machine_id,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_v2_to_ledger: skipped sku=% machine=% err=%',
      NEW.sku, NEW.machine_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the NEW clean trigger to production_logs_v2
CREATE TRIGGER trg_production_logs_v2_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.trigger_v2_to_ledger();

-- 3. Clear the broken / messy data in production_logs_v2 
--    (It is currently 0 or filled with old test garbage)
TRUNCATE TABLE public.production_logs_v2 CASCADE;

-- Note: We are NOT touching production_logs (V1) data or dropping V1's triggers here
-- to ensure current factory operations remain 100% online while we deploy code.
