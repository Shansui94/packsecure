-- ============================================================
-- SQL 1: 基础设施修复 (RLS + RPC + 自动扣库存 Trigger)
-- 先执行这个
-- ============================================================

-- STEP 1: RLS SELECT 策略
ALTER TABLE public.stock_ledger_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read stock_ledger_v2" ON public.stock_ledger_v2;
CREATE POLICY "Allow read stock_ledger_v2"
ON public.stock_ledger_v2 FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read stock_ledger_v2" ON public.stock_ledger_v2;
CREATE POLICY "Allow anon read stock_ledger_v2"
ON public.stock_ledger_v2 FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.stock_ledger_v2;
CREATE POLICY "Enable insert for authenticated users"
ON public.stock_ledger_v2 FOR INSERT TO public WITH CHECK (true);

-- STEP 2: 修复 RPC
DROP FUNCTION IF EXISTS public.get_live_stock_viewer();
CREATE OR REPLACE FUNCTION public.get_live_stock_viewer()
RETURNS TABLE (sku VARCHAR, name VARCHAR, current_stock NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT v.sku::VARCHAR, v.name::VARCHAR,
         SUM(v.current_stock)::NUMERIC as current_stock
  FROM public.v2_inventory_view v
  GROUP BY v.sku, v.name
  ORDER BY current_stock DESC, v.sku ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_live_stock_viewer() TO authenticated, anon;

-- STEP 3: 自动扣库存 Trigger (订单创建时扣)
CREATE TABLE IF NOT EXISTS public._sku_legacy_map (
    legacy_sku TEXT PRIMARY KEY,
    v2_sku TEXT NOT NULL
);
INSERT INTO public._sku_legacy_map (legacy_sku, v2_sku) VALUES
    ('DL-20CM','BW-DL-CLR-100Mx20CMx5ROLL-BLU'),('DL-25CM','BW-DL-CLR-100Mx25CMx4ROLL-BLU'),
    ('DL-33CM','BW-DL-CLR-100Mx33CMx3ROLL-BLU'),('DL-FULL','BW-DL-CLR-100Mx100CMx1ROLL-YEL'),
    ('DL-HALF','BW-DL-CLR-100Mx50CMx2ROLL-BLU'),('DL-HITAM-20CM','BW-DL-BLK-100Mx20CMx5ROLL-RED'),
    ('DL-HITAM-25CM','BW-DL-BLK-100Mx25CMx4ROLL-RED'),('DL-HITAM-33CM','BW-DL-BLK-100Mx33CMx3ROLL-RED'),
    ('DL-HITAM-FULL','BW-DL-BLK-100Mx100CMx1ROLL-RED'),('DL-HITAM-HALF','BW-DL-BLK-100Mx50CMx2ROLL-GRN'),
    ('HITAM-20CM','BW-SL-BLK-100Mx20CMx5ROLL-GRN'),('HITAM-25CM','BW-SL-BLK-100Mx25CMx4ROLL-GRN'),
    ('HITAM-33CM','BW-SL-BLK-100Mx33CMx3ROLL-GRN'),('HITAM-FULL','BW-SL-BLK-100Mx100CMx1ROLL-GRN'),
    ('HITAM-HALF','BW-SL-BLK-100Mx50CMx2ROLL-RED'),('MERAH','BW-SL-CLR-100Mx100CMx1ROLL-RED'),
    ('OREN','BW-SL-CLR-100Mx100CMx1ROLL-ORN'),('SILVER-GREY','BW-SL-SLV-100Mx100CMx1ROLL'),
    ('SL-20CM','BW-SL-CLR-100Mx20CMx5ROLL-GRN'),('SL-25CM','BW-SL-CLR-100Mx25CMx4ROLL-GRN'),
    ('SL-33CM','BW-SL-CLR-100Mx33CMx3ROLL-GRN')
ON CONFLICT (legacy_sku) DO NOTHING;

CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
    item JSONB; v_sku TEXT; v_qty NUMERIC; v_loc TEXT; v_mapped TEXT; v_nickname_sku TEXT; v_ts TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
        v_ts := (NEW.deadline::date)::timestamptz AT TIME ZONE 'Asia/Kuala_Lumpur';
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
            v_sku := item->>'sku';
            v_qty := COALESCE((item->>'quantity')::NUMERIC, 0);
            v_loc := COALESCE(NULLIF(item->>'sourceLocation', ''), 'OPM Lama');
            IF v_loc = 'Unassigned' OR v_loc = 'general' THEN v_loc := 'OPM Lama'; END IF;
            IF NOT EXISTS (SELECT 1 FROM public.sys_locations_v2 WHERE loc_id = v_loc) THEN
                v_loc := 'OPM Lama';
            END IF;

            -- 自动纠错替换：把操作员可能输入的空格 " " 转化为横杠 "-"
            v_sku := REPLACE(v_sku, ' ', '-');

            SELECT v2_sku INTO v_mapped FROM public._sku_legacy_map WHERE legacy_sku = v_sku;
            IF v_mapped IS NOT NULL THEN v_sku := v_mapped;
            ELSE SELECT mi.sku INTO v_nickname_sku FROM public.master_items_v2 mi WHERE mi.nickname = v_sku LIMIT 1;
                 IF v_nickname_sku IS NOT NULL THEN v_sku := v_nickname_sku; END IF;
            END IF;
            IF v_qty > 0 THEN
                INSERT INTO public.stock_ledger_v2 (sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp)
                VALUES (v_sku, -v_qty, 'Transfer Out', v_loc, NEW.order_number, 'Auto-deduct: Order Created', v_ts);
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_deduct_stock ON public.sales_orders;
CREATE TRIGGER trg_auto_deduct_stock
    AFTER INSERT ON public.sales_orders
    FOR EACH ROW EXECUTE FUNCTION public.auto_deduct_stock_on_order();

SELECT '✅ SQL 1 完成: RLS + RPC + Trigger' as status;
