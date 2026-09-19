-- =====================================================================
-- 🚨 PACKSECURE OS: DATABASE V2 DEBT CURE & CANONICALIZATION 🚨
-- Purpose: Formalize _v2 tables into canonical standard tables while 
--          creating zero-downtime backward-compatible _v2 views.
-- Date: 2026-09-20
-- =====================================================================

BEGIN;

-- 1. DROP EXISTING DEPENDENT VIEW TEMPORARILY FOR RENAME
DROP VIEW IF EXISTS public.v2_inventory_view CASCADE;

-- 2. RENAME PHYSICAL V2 TABLES TO CANONICAL STANDARD NAMES
ALTER TABLE IF EXISTS public.sys_machines_v2 RENAME TO sys_machines;
ALTER TABLE IF EXISTS public.master_items_v2 RENAME TO master_items;
ALTER TABLE IF EXISTS public.production_logs_v2 RENAME TO production_logs;
ALTER TABLE IF EXISTS public.stock_ledger_v2 RENAME TO stock_ledger;

-- 3. RECREATE CANONICAL INVENTORY VIEW
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT 
    m.sku,
    m.name,
    m.type,
    m.uom,
    l.loc_id,
    COALESCE(SUM(l.change_qty), 0::numeric) AS current_stock,
    MAX(l."timestamp") AS last_updated
FROM public.master_items m
    LEFT JOIN public.stock_ledger l ON m.sku::text = l.sku::text AND l."timestamp" <= CURRENT_TIMESTAMP
GROUP BY m.sku, m.name, m.type, m.uom, l.loc_id;

-- 4. UPDATE PRODUCTION TRIGGER FUNCTION TO WRITE TO CANONICAL stock_ledger
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
      INSERT INTO public.stock_ledger (
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

-- Reattach trigger on canonical production_logs table if not already attached
DROP TRIGGER IF EXISTS trg_distribute_production_to_ledger ON public.production_logs;
CREATE TRIGGER trg_distribute_production_to_ledger
AFTER INSERT ON public.production_logs
FOR EACH ROW
EXECUTE FUNCTION public.distribute_production_to_ledger();

-- 5. CREATE ZERO-DOWNTIME BACKWARD COMPATIBLE VIEWS
-- Any un-migrated code or queries requesting *_v2 will transparently read from canonical tables
CREATE OR REPLACE VIEW public.sys_machines_v2 AS
SELECT * FROM public.sys_machines;

CREATE OR REPLACE VIEW public.master_items_v2 AS
SELECT * FROM public.master_items;

CREATE OR REPLACE VIEW public.production_logs_v2 AS
SELECT * FROM public.production_logs;

CREATE OR REPLACE VIEW public.stock_ledger_v2 AS
SELECT * FROM public.stock_ledger;

CREATE OR REPLACE VIEW public.v2_inventory_view AS
SELECT * FROM public.inventory_view;

-- 6. ENSURE RLS POLICIES REMAIN ACTIVE ON CANONICAL TABLES
ALTER TABLE public.sys_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sys_machines' AND policyname = 'sys_machines_all_access') THEN
        CREATE POLICY "sys_machines_all_access" ON public.sys_machines FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'master_items' AND policyname = 'master_items_all_access') THEN
        CREATE POLICY "master_items_all_access" ON public.master_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_logs' AND policyname = 'production_logs_all_access') THEN
        CREATE POLICY "production_logs_all_access" ON public.production_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_ledger' AND policyname = 'stock_ledger_all_access') THEN
        CREATE POLICY "stock_ledger_all_access" ON public.stock_ledger FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';

COMMIT;

