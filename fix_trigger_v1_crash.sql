-- FIX: Reverting the trigger sharing issue between v1 and v2

-- 1. Create a dedicated trigger function for v2
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
      'Auto-Log: ' || NEW.machine_id,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trigger_v2_to_ledger: skipped sku=% machine=% err=%',
      NEW.sku, NEW.machine_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the v2 function to the v2 table
DROP TRIGGER IF EXISTS trg_production_to_ledger ON public.production_logs_v2;
CREATE TRIGGER trg_production_logs_v2_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.trigger_v2_to_ledger();


-- 2. Restore the original behavior of distribute_production_to_ledger for v1
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  product_count INTEGER;
  qty_per_product NUMERIC;
BEGIN
  -- For v1 table, it uses alarm_count, machine_id, product_sku, id
  
  -- If it's a reboot (alarm_count 0), do nothing
  IF NEW.alarm_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO product_count
  FROM public.machine_active_products
  WHERE machine_id = NEW.machine_id;

  IF product_count = 0 THEN
    RETURN NEW;
  END IF;

  qty_per_product := NEW.alarm_count::NUMERIC / product_count;

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
        'Auto-Log (v1): ' || NEW.machine_id || ' (Split ' || product_count || ')',
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
