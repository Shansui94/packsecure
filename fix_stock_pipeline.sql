-- ============================================================
-- FIX: Production → Stock Pipeline (distribute_production_to_ledger)
-- ============================================================
-- ROOT CAUSE: The trigger function references NEW.alarm_count and NEW.id
-- but production_logs_v2 uses output_qty and log_id.
-- This column mismatch causes the trigger to silently fail,
-- resulting in 33,094 production records that never entered stock_ledger_v2.
--
-- Run this in Supabase SQL Editor.
-- ============================================================

-- STEP 1: Fix the trigger function to use correct column names
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

  -- 2. If no products assigned, skip
  IF product_count = 0 THEN
    RETURN NEW;
  END IF;

  -- 3. Use output_qty (correct v2 column, NOT alarm_count)
  qty_per_product := COALESCE(NEW.output_qty, 1)::NUMERIC / product_count;

  -- 4. Insert stock ledger entry for each active product
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
        NEW.log_id::text,   -- ← was NEW.id, now NEW.log_id
        'Auto-Log: ' || NEW.machine_id || ' (Split ' || product_count || ')',
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'distribute_production_to_ledger: skipped sku=% for machine=% err=%',
        rec.product_sku, NEW.machine_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Make sure the trigger is attached to production_logs_v2
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;

CREATE TRIGGER trg_production_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.distribute_production_to_ledger();

-- STEP 3: Backfill — Replay ALL existing production_logs_v2 into stock_ledger_v2
-- This will process ALL 33,094 pending records.
-- ⚠️ WARNING: This may take a few seconds. Run it AFTER Steps 1 & 2.

INSERT INTO public.stock_ledger_v2 (sku, change_qty, event_type, ref_doc, notes, timestamp)
SELECT
  map.product_sku,
  COALESCE(pl.output_qty, 1)::NUMERIC / (
    SELECT COUNT(*) FROM public.machine_active_products
    WHERE machine_id = pl.machine_id
  ),
  'Production',
  pl.log_id::text,
  'Backfill: ' || pl.machine_id,
  pl.created_at
FROM public.production_logs_v2 pl
JOIN public.machine_active_products map
  ON map.machine_id = pl.machine_id
WHERE NOT EXISTS (
  -- Prevent duplicates if run multiple times
  SELECT 1 FROM public.stock_ledger_v2 sl
  WHERE sl.ref_doc = pl.log_id::text AND sl.event_type = 'Production'
);
