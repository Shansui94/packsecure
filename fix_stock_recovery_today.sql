-- ============================================================
-- SQL 2: 恢复今天全部 17 个订单的出库记录
-- 执行完 SQL 1 之后再执行这个
-- WHERE NOT EXISTS 防重复，安全执行
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
    v_skip INT := 0;
BEGIN
    FOR rec IN
        SELECT id, order_number, status, items, deadline
        FROM public.sales_orders
        WHERE deadline = '2026-04-07'
          AND items IS NOT NULL
          AND jsonb_array_length(items) > 0
    LOOP
        v_ts := (rec.deadline::date)::timestamptz AT TIME ZONE 'Asia/Kuala_Lumpur';

        FOR item IN SELECT * FROM jsonb_array_elements(rec.items)
        LOOP
            v_sku := item->>'sku';
            v_qty := COALESCE((item->>'quantity')::NUMERIC, 0);
            v_loc := COALESCE(NULLIF(item->>'sourceLocation', ''), 'OPM Lama');
            IF v_loc = 'Unassigned' OR v_loc = 'general' THEN v_loc := 'OPM Lama'; END IF;

            -- SKU mapping
            SELECT v2_sku INTO v_mapped FROM public._sku_legacy_map WHERE legacy_sku = v_sku;
            IF v_mapped IS NOT NULL THEN v_sku := v_mapped;
            ELSE
                SELECT mi.sku INTO v_nickname_sku FROM public.master_items_v2 mi WHERE mi.nickname = v_sku LIMIT 1;
                IF v_nickname_sku IS NOT NULL THEN v_sku := v_nickname_sku; END IF;
            END IF;

            IF v_qty > 0 THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.stock_ledger_v2
                    WHERE ref_doc = rec.order_number AND sku = v_sku AND change_qty < 0
                ) THEN
                    INSERT INTO public.stock_ledger_v2 (
                        sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
                    ) VALUES (
                        v_sku, -v_qty, 'Transfer Out', v_loc,
                        rec.order_number,
                        'Recovery: ' || rec.order_number || ' (' || rec.status || ')',
                        v_ts
                    );
                    v_count := v_count + 1;
                ELSE
                    v_skip := v_skip + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ 完成: 插入 % 条, 跳过 % 条(已存在)', v_count, v_skip;
END $$;

-- 验证
SELECT ref_doc, sku, change_qty, loc_id, notes
FROM stock_ledger_v2
WHERE ref_doc LIKE 'DO-2026-%'
  AND (notes LIKE 'Recovery:%' OR notes LIKE 'Auto-deduct:%')
  AND timestamp >= '2026-04-06T16:00:00+00:00'
ORDER BY ref_doc, sku;
