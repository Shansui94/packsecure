-- ============================================================
-- 紧急强行覆盖 LiveStock 数据脚本
-- 直接拉平所有仓库的错误数据，强制显示为截图中指定的实际数量
-- 在 Supabase Dashboard SQL Editor 运行
-- ============================================================

DO $$
DECLARE
    audit_data JSONB := '[
        {"sku": "BW-SL-CLR-100Mx100CMx1ROLL-RED", "actual": 213},
        {"sku": "BW-DL-CLR-100Mx100CMx1ROLL-YEL", "actual": 224},
        {"sku": "BW-SL-BLK-100Mx100CMx1ROLL-GRN", "actual": 130},
        {"sku": "BW-DL-CLR-100Mx100CMx1ROLL-RED", "actual": 0},
        {"sku": "BW-SL-CLR-100Mx33CMx3ROLL-GRN", "actual": 15},
        {"sku": "BW-SL-CLR-100Mx33CMx3ROLL-BLU", "actual": 0},
        {"sku": "BW-SL-CLR-100Mx50CMx2ROLL-ORN", "actual": 132},
        {"sku": "BW-SL-CLR-100Mx20CMx5ROLL-GRN", "actual": 33},
        {"sku": "BW-SL-CLR-100Mx25CMx4ROLL-GRN", "actual": 57}
    ]';
    rec JSONB;
    v_sku TEXT;
    v_actual NUMERIC;
    v_current NUMERIC;
    v_diff NUMERIC;
BEGIN
    FOR rec IN SELECT * FROM jsonb_array_elements(audit_data)
    LOOP
        v_sku := rec->>'sku';
        v_actual := (rec->>'actual')::NUMERIC;

        -- 算出现在 LiveStock (All Locations) 显示的错误总数
        SELECT COALESCE(SUM(change_qty), 0) INTO v_current
        FROM public.stock_ledger_v2
        WHERE sku = v_sku;

        v_diff := v_actual - v_current;

        -- 如果现在数字不对，就插入一个强行抵消记录
        IF v_diff != 0 THEN
            INSERT INTO public.stock_ledger_v2 (
                sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
            ) VALUES (
                v_sku, v_diff, 'System Reset', 'OPM Lama', 
                'FORCE-RESET-' || to_char(NOW() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD'),
                '紧急覆盖: 强行将全部仓库总数从 ' || v_current || ' 改为 ' || v_actual,
                NOW()
            );
            RAISE NOTICE '✅ %: 强行调整了 % (目前 % -> 正确 %)', v_sku, v_diff, v_current, v_actual;
        ELSE
            RAISE NOTICE '✅ %: 数字已经是 %，无需覆盖', v_sku, v_actual;
        END IF;
    END LOOP;
END $$;
