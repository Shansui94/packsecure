-- ============================================================
-- 修复生产入库缺少 loc_id 的问题
-- 在 Supabase Dashboard SQL Editor 执行
-- ============================================================

-- 1. 更新历史遗留的 Unassigned 生产入库记录为 'OPM Lama'
UPDATE public.stock_ledger_v2
SET loc_id = 'OPM Lama'
WHERE (loc_id IS NULL OR loc_id = 'Unassigned')
  AND event_type = 'Production';

SELECT '✅ 历史生产入库记录已迁移至 OPM Lama' as status;

-- 2. 修改生产 Trigger，让未来的生产自动带上 loc_id = 'OPM Lama'
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
      -- 根据机器前缀判断是哪个厂
      DECLARE
        v_loc TEXT;
      BEGIN
        IF NEW.machine_id LIKE 'N%' THEN
            v_loc := 'Nilai';
        ELSIF NEW.machine_id LIKE 'T%' THEN
            v_loc := 'OPM Lama';
        ELSE
            v_loc := 'OPM Lama'; -- 以防万一
        END IF;

        INSERT INTO public.stock_ledger_v2 (
          sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
        ) VALUES (
          rec.product_sku,
          qty_per_product,
          'Production',
          v_loc,         
          NEW.id::text,
          'Auto-Log: ' || NEW.machine_id || ' (Split ' || product_count || ')',
          NOW()
        );
      END;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'distribute_production_to_ledger: skipped sku=% for machine=% err=%',
        rec.product_sku, NEW.machine_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT '✅ 生产入库 Trigger 已更新 (自动设为 OPM Lama)' as status;
