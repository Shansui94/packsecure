-- ============================================================
-- EMERGENCY ROLLBACK SCRIPT
-- Reverts database triggers and deletes any data generated
-- by the recent stock backfill.
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Restore the EXACT original version of the distribute trigger
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  product_count INTEGER;
  qty_per_product NUMERIC;
BEGIN
  -- 1. Count how many active products this machine has
  SELECT COUNT(*) INTO product_count
  FROM public.machine_active_products
  WHERE machine_id = NEW.machine_id;

  -- 2. If no products, do nothing
  IF product_count = 0 THEN
    RETURN NEW;
  END IF;

  -- 3. Calculate quantity per product
  qty_per_product := NEW.alarm_count::NUMERIC / product_count;

  -- 4. Loop through ALL active products and update ledger
  FOR rec IN
    SELECT product_sku
    FROM public.machine_active_products
    WHERE machine_id = NEW.machine_id
  LOOP
    BEGIN
      INSERT INTO public.stock_ledger_v2 (
        sku,
        change_qty,
        event_type,
        ref_doc,
        notes,
        timestamp
      ) VALUES (
        rec.product_sku,
        qty_per_product,
        'Production',
        NEW.id::text,
        'Auto-Log: ' || NEW.machine_id || ' (Split ' || product_count || ')',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- SKU not found in master table or other error: skip stock update, still log production
      RAISE WARNING 'distribute_production_to_ledger: skipped sku=% for machine=% err=%',
        rec.product_sku, NEW.machine_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the newly created v2-specific trigger
DROP TRIGGER IF EXISTS trg_production_logs_v2_to_ledger ON public.production_logs_v2;
DROP FUNCTION IF EXISTS public.trigger_v2_to_ledger();

-- 3. Restore the original v2 trigger binding (even though it originally failed)
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;
CREATE TRIGGER trg_production_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.distribute_production_to_ledger();

-- 4. Delete the backfilled / auto-inserted stock records from today
-- ONLY deleting 'Production' events to avoid touching manual audits or outbound transfers.
DELETE FROM public.stock_ledger_v2
WHERE event_type = 'Production'
  AND timestamp >= '2026-03-27 00:00:00+00';
