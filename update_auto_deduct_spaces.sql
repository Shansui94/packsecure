-- ============================================================
-- 优化扣库功能：自动兼容空格与横杠的混淆输入 (DL FULL => DL-FULL)
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_deduct_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
    item JSONB; 
    v_sku TEXT; 
    v_qty NUMERIC; 
    v_loc TEXT; 
    v_mapped TEXT; 
    v_nickname_sku TEXT; 
    v_ts TIMESTAMPTZ;
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

            -- 🔥自动纠错：把输入里面的空格强制转换成横杠 "-"，再去做搜索
            v_sku := REPLACE(v_sku, ' ', '-');

            -- 继续搜寻它的真实身份
            SELECT v2_sku INTO v_mapped FROM public._sku_legacy_map WHERE legacy_sku = v_sku;
            IF v_mapped IS NOT NULL THEN 
                v_sku := v_mapped;
            ELSE 
                SELECT mi.sku INTO v_nickname_sku FROM public.master_items_v2 mi WHERE mi.nickname = v_sku LIMIT 1;
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

SELECT '✅ DEDUCT TRIGGER UPDATED: Spaces will now be treated exactly like hyphens!' as status;
