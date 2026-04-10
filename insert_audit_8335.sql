-- ============================================================
-- 植入 Audit 记录 (Auditor: 8335)
-- 前提: 已经执行了 zero_all_stock.sql (所有库存现在是 0)
-- ============================================================

DO $$
DECLARE
    -- 按照图片里的顺序和数据
    -- 如果有重复的 SKU（比如最后的 100Mx33CMx3ROLL-BLU），以最后一行（0）为准
    audit_data JSONB := '[
        {"sku": "BW-SL-CLR-100Mx100CMx1ROLL-RED", "actual": 213},
        {"sku": "BW-DL-CLR-100Mx100CMx1ROLL-YEL", "actual": 224},
        {"sku": "BW-SL-BLK-100Mx100CMx1ROLL-GRN", "actual": 130},
        {"sku": "BW-DL-CLR-100Mx100CMx1ROLL-RED", "actual": 0},
        {"sku": "BW-SL-CLR-100Mx33CMx3ROLL-GRN", "actual": 15},
        {"sku": "BW-SL-CLR-100Mx50CMx2ROLL-ORN", "actual": 160},
        {"sku": "BW-SL-CLR-100Mx20CMx5ROLL-GRN", "actual": 33},
        {"sku": "BW-SL-CLR-100Mx25CMx4ROLL-GRN", "actual": 57},
        {"sku": "BW-SL-CLR-100Mx33CMx3ROLL-BLU", "actual": 0}
    ]';
    rec JSONB;
    v_sku TEXT;
    v_actual NUMERIC;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(audit_data)
    LOOP
        v_sku := rec->>'sku';
        v_actual := (rec->>'actual')::NUMERIC;

        IF v_actual > 0 THEN
            INSERT INTO public.stock_ledger_v2 (
                sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
            ) VALUES (
                v_sku, v_actual, 'Audit Adjustment', 'OPM Lama',
                'AUDIT-8335',
                'Initial Audit by 8335',
                NOW()
            );
            RAISE NOTICE '✅ 注入成功: % 数量 %', v_sku, v_actual;
        END IF;
    END LOOP;

    RAISE NOTICE '🎉 全部 Audit 记录已成功植入 OPM Lama！';
END $$;
