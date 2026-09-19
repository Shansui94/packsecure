-- =====================================================================
-- 🚨 PACKSECURE OS: ROLLBACK SCRIPT FOR V2 DEBT CURE 🚨
-- Purpose: Safely rollback canonical tables back to _v2 if ever needed.
-- Date: 2026-09-20
-- =====================================================================

BEGIN;

-- 1. DROP COMPATIBILITY VIEWS
DROP VIEW IF EXISTS public.sys_machines_v2 CASCADE;
DROP VIEW IF EXISTS public.master_items_v2 CASCADE;
DROP VIEW IF EXISTS public.production_logs_v2 CASCADE;
DROP VIEW IF EXISTS public.stock_ledger_v2 CASCADE;
DROP VIEW IF EXISTS public.v2_inventory_view CASCADE;
DROP VIEW IF EXISTS public.inventory_view CASCADE;

-- 2. RENAME BACK TO V2 PHYSICAL NAMES
ALTER TABLE IF EXISTS public.sys_machines RENAME TO sys_machines_v2;
ALTER TABLE IF EXISTS public.master_items RENAME TO master_items_v2;
ALTER TABLE IF EXISTS public.production_logs RENAME TO production_logs_v2;
ALTER TABLE IF EXISTS public.stock_ledger RENAME TO stock_ledger_v2;

-- 3. REBUILD V2 INVENTORY VIEW
CREATE OR REPLACE VIEW public.v2_inventory_view AS
SELECT 
    m.sku,
    m.name,
    m.type,
    m.uom,
    l.loc_id,
    COALESCE(SUM(l.change_qty), 0::numeric) AS current_stock,
    MAX(l."timestamp") AS last_updated
FROM public.master_items_v2 m
    LEFT JOIN public.stock_ledger_v2 l ON m.sku::text = l.sku::text AND l."timestamp" <= CURRENT_TIMESTAMP
GROUP BY m.sku, m.name, m.type, m.uom, l.loc_id;

-- 4. REVERT TRIGGER TARGET TO stock_ledger_v2
CREATE OR REPLACE FUNCTION public.distribute_production_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  product_count INTEGER;
  qty_per_product NUMERIC;
BEGIN
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

DROP TRIGGER IF EXISTS trg_distribute_production_to_ledger ON public.production_logs_v2;
CREATE TRIGGER trg_distribute_production_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW
EXECUTE FUNCTION public.distribute_production_to_ledger();

COMMIT;
