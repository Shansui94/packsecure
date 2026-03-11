-- 1. Fix the trigger to explicitly use the API-provided alarm_count!
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert one ledger row for the EXACT product in the log
  -- This relies on api/alarm.ts correctly splitting the lanes and calculating the yield.
  IF NEW.product_sku IS NOT NULL AND NEW.product_sku != 'UNKNOWN' THEN
     INSERT INTO public.stock_ledger_v2 (
       sku, change_qty, event_type, ref_doc, notes, timestamp
     ) VALUES (
       NEW.product_sku,
       NEW.alarm_count,
       'Production',
       NEW.id::text,
       'Auto-Log: ' || NEW.machine_id,
       NEW.created_at
     );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix the Yields for T1.2 so the API inserts the correct `alarm_count`
UPDATE public.machine_active_products 
SET yield = 2 
WHERE machine_id = 'T1.2-M01' AND lane_id = 'Lane1';

UPDATE public.machine_active_products 
SET yield = 4 
WHERE machine_id = 'T1.2-M01' AND lane_id = 'Lane2';
