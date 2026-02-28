-- ============================================================
-- Fix: Production Output Calculation (rolls_per_alarm)
-- Fixes firmware over-reporting on 100cm machines (T1.3, N1, N2)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add rolls_per_alarm column to sys_machines_v2
ALTER TABLE public.sys_machines_v2
ADD COLUMN IF NOT EXISTS rolls_per_alarm INTEGER NOT NULL DEFAULT 1;

-- Step 2: Set correct values per machine
-- T1.2-M01: 200cm machine, each alarm = 2 rolls
UPDATE public.sys_machines_v2 SET rolls_per_alarm = 2 WHERE machine_id = 'T1.2-M01';

-- T1.3-M02, N1-M01, N2-M02: 100cm machines, each alarm = 1 roll (firmware sends 2 but wrong)
UPDATE public.sys_machines_v2 SET rolls_per_alarm = 1 WHERE machine_id IN ('T1.3-M02', 'N1-M01', 'N2-M02');

-- T1.1-M03 (Stretch Film): default 1, no production tracking needed
-- Already covered by DEFAULT 1

-- Step 3: Update the trigger to use rolls_per_alarm instead of alarm_count directly
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  product_count INTEGER;
  machine_rolls_per_alarm INTEGER;
  qty_per_product NUMERIC;
BEGIN
  -- Look up how many rolls this machine produces per alarm pulse
  SELECT COALESCE(rolls_per_alarm, 1) INTO machine_rolls_per_alarm
  FROM public.sys_machines_v2
  WHERE machine_id = NEW.machine_id;

  -- Count how many active products this machine has (for splitting)
  SELECT COUNT(*) INTO product_count
  FROM public.machine_active_products
  WHERE machine_id = NEW.machine_id;

  IF product_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Each product gets an equal share of the actual rolls produced
  qty_per_product := machine_rolls_per_alarm::NUMERIC / product_count;

  -- Insert one ledger row per active product
  FOR rec IN
    SELECT product_sku
    FROM public.machine_active_products
    WHERE machine_id = NEW.machine_id
  LOOP
    BEGIN
      INSERT INTO public.stock_ledger_v2 (
        sku, change_qty, event_type, ref_doc, notes, timestamp
      ) VALUES (
        rec.product_sku,
        qty_per_product,
        'Production',
        NEW.id::text,
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

-- Verify
SELECT machine_id, name, base_width, rolls_per_alarm FROM public.sys_machines_v2 ORDER BY machine_id;
