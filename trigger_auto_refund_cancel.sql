-- ============================================================
-- 自动化退库 Trigger：当订单状态变为 Cancelled 时，自动返还预扣的库存
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_refund_stock_on_cancel()
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
    -- 判断条件：旧状态不是 Cancelled，新状态是 Cancelled
    IF OLD.status IS DISTINCT FROM 'Cancelled' AND NEW.status = 'Cancelled' THEN
        v_ts := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kuala_Lumpur';
        
        IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
                v_sku := item->>'sku';
                v_qty := COALESCE((item->>'quantity')::NUMERIC, 0);
                v_loc := COALESCE(NULLIF(item->>'sourceLocation', ''), 'OPM Lama');
                
                -- 常规清洗地点
                IF v_loc = 'Unassigned' OR v_loc = 'general' THEN v_loc := 'OPM Lama'; END IF;
                IF NOT EXISTS (SELECT 1 FROM public.sys_locations_v2 WHERE loc_id = v_loc) THEN
                    v_loc := 'OPM Lama';
                END IF;

                -- 自动纠错替换：把操作员可能输入的空格 " " 转化为横杠 "-"
                v_sku := REPLACE(v_sku, ' ', '-');

                -- 匹配真实 SKU
                SELECT v2_sku INTO v_mapped FROM public._sku_legacy_map WHERE legacy_sku = v_sku;
                IF v_mapped IS NOT NULL THEN 
                    v_sku := v_mapped;
                ELSE 
                    SELECT mi.sku INTO v_nickname_sku FROM public.master_items_v2 mi WHERE mi.nickname = v_sku LIMIT 1;
                    IF v_nickname_sku IS NOT NULL THEN v_sku := v_nickname_sku; END IF;
                END IF;
                
                IF v_qty > 0 THEN
                    -- 退回库存：执行正数的插入
                    INSERT INTO public.stock_ledger_v2 (
                        sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
                    ) VALUES (
                        v_sku, v_qty, 'Cancellation Refund', v_loc, 
                        NEW.order_number, 
                        'Auto-refund: Order Cancelled', 
                        v_ts
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_refund_stock ON public.sales_orders;
CREATE TRIGGER trg_auto_refund_stock
    AFTER UPDATE ON public.sales_orders
    FOR EACH ROW EXECUTE FUNCTION public.auto_refund_stock_on_cancel();

SELECT '✅ Trigger: Auto Refund on Cancel configured.' as status;
