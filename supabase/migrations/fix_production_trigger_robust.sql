-- Fix: Make the production trigger robust against invalid SKUs
-- Run this in Supabase SQL Editor

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
