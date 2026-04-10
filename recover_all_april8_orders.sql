-- ============================================================
-- 漏扣单子大补救：填补所有4月8日及之后送货单的库存扣除
-- (因为在没有装 Trigger 之前，存在的单子全都是没扣库存的)
--
-- 这个脚本会自动寻找 deadline >= '2026-04-08' 的订单，
-- 只要在 stock_ledger_v2 没有记录，它就会自动补扣一条。防重复安全！
-- ============================================================

DO $$
DECLARE
    rec RECORD;
    item JSONB;
    v_sku TEXT;
    v_qty NUMERIC;
    v_loc TEXT;
    v_mapped TEXT;
    v_nickname_sku TEXT;
    v_ts TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    -- 1. 寻找所有4月8日及以后的订单
    FOR rec IN
        SELECT id, order_number, status, items, deadline
        FROM public.sales_orders
        WHERE deadline >= '2026-04-08'
          AND status != 'Cancelled'   -- 关键修复：绝不能扣除已取消的订单！
          AND items IS NOT NULL
          AND jsonb_array_length(items) > 0
    LOOP
        -- 时间设置为 deadline 的当天 00:00，与新版出库逻辑一致
        v_ts := (rec.deadline::date)::timestamptz AT TIME ZONE 'Asia/Kuala_Lumpur';

        FOR item IN SELECT * FROM jsonb_array_elements(rec.items)
        LOOP
            v_sku := item->>'sku';
            v_qty := COALESCE((item->>'quantity')::NUMERIC, 0);
            v_loc := COALESCE(NULLIF(item->>'sourceLocation', ''), 'OPM Lama');
            IF v_loc = 'Unassigned' OR v_loc = 'general' THEN v_loc := 'OPM Lama'; END IF;

            -- 关键修复: 如果遇到错别字 (比如 OPM Ali)，保护数据库防止外键报错
            IF NOT EXISTS (SELECT 1 FROM public.sys_locations_v2 WHERE loc_id = v_loc) THEN
                v_loc := 'OPM Lama';
            END IF;

            -- 兼容老系统 SKU
            SELECT v2_sku INTO v_mapped FROM public._sku_legacy_map WHERE legacy_sku = v_sku;
            IF v_mapped IS NOT NULL THEN
                v_sku := v_mapped;
            ELSE
                SELECT mi.sku INTO v_nickname_sku FROM public.master_items_v2 mi WHERE mi.nickname = v_sku LIMIT 1;
                IF v_nickname_sku IS NOT NULL THEN v_sku := v_nickname_sku; END IF;
            END IF;

            IF v_qty > 0 THEN
                -- 防重复：如果这个订单还从未触发过 Transfer Out，就给它扣除
                IF NOT EXISTS (
                    SELECT 1 FROM public.stock_ledger_v2
                    WHERE ref_doc = rec.order_number
                      AND sku = v_sku
                      AND event_type = 'Transfer Out'
                ) THEN
                    INSERT INTO public.stock_ledger_v2 (
                        sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
                    ) VALUES (
                        v_sku, -v_qty, 'Transfer Out', v_loc,
                        rec.order_number,
                        '补救修复: ' || rec.order_number || ' 自动出库',
                        v_ts
                    );
                    v_count := v_count + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ 补救完成！一共插入了 % 条出库记录', v_count;
END $$;
