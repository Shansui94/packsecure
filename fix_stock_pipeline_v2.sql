-- ============================================================
-- FIX v2: Production → Stock Pipeline (Corrected)
-- ============================================================
-- FINDINGS:
-- 1. The trigger was fixed (Step 1 & 2 from previous SQL are done).
-- 2. Backfill returned 0 rows because the JOIN to machine_active_products
--    doesn't work for history — machine_active_products only has CURRENT products.
-- 3. production_logs_v2 already stores the SKU directly in the 'sku' column!
--    So we can backfill directly WITHOUT joining machine_active_products.
-- 4. The backfill failed because 'BW-SL-CLR-100Mx100CMx1ROLL-RED' is NOT
--    registered in master_items_v2, causing FK constraint violation.
--
-- THIS SCRIPT FIXES BOTH. Run in Supabase SQL Editor.
-- ============================================================

-- STEP A: Register the missing MERAH SKU in master_items_v2
-- (so the FK constraint stops blocking it)
INSERT INTO public.master_items_v2 (sku, name, type, uom, status, supply_type)
VALUES
  ('BW-SL-CLR-100Mx100CMx1ROLL-RED', 'MERAH (SL FULL)', 'FG', 'Roll', 'Active', 'Manufactured')
ON CONFLICT (sku) DO NOTHING;

-- Also register OREN and GREEN while we're at it
INSERT INTO public.master_items_v2 (sku, name, type, uom, status, supply_type)
VALUES
  ('BW-SL-CLR-100Mx50CMx2ROLL-ORN', 'OREN (SL HALF)', 'FG', 'Roll', 'Active', 'Manufactured'),
  ('BW-SL-CLR-100Mx33CMx3ROLL-GRN', 'HIJAU (SL 33CM)', 'FG', 'Roll', 'Active', 'Manufactured')
ON CONFLICT (sku) DO NOTHING;

-- STEP B: Backfill ALL production_logs_v2 records using the sku column directly
-- (no join needed — sku is already stored per row)
INSERT INTO public.stock_ledger_v2 (sku, change_qty, event_type, ref_doc, notes, timestamp)
SELECT
  pl.sku,
  COALESCE(pl.output_qty, 1)::NUMERIC,
  'Production',
  pl.log_id::text,
  'Backfill: ' || pl.machine_id,
  pl.created_at
FROM public.production_logs_v2 pl
WHERE
  -- Only SKUs that exist in master (to avoid FK errors)
  pl.sku IN (SELECT sku FROM public.master_items_v2)
  -- No duplicates
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_ledger_v2 sl
    WHERE sl.ref_doc = pl.log_id::text AND sl.event_type = 'Production'
  )
ORDER BY pl.created_at;

-- STEP C: Also update the trigger to use 'sku' from production_logs_v2 directly
-- (instead of looking up machine_active_products at trigger time)
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  -- Use the sku stored directly in the production log row
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
      'Auto-Log: ' || NEW.machine_id,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'distribute_production_to_ledger: skipped sku=% machine=% err=%',
      NEW.sku, NEW.machine_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify trigger is still attached
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;
CREATE TRIGGER trg_production_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.distribute_production_to_ledger();

-- Final check: how many rows now in stock_ledger_v2?
SELECT event_type, COUNT(*) as entries, SUM(change_qty) as total_qty
FROM public.stock_ledger_v2
GROUP BY event_type
ORDER BY event_type;
