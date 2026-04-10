-- ============================================================
-- 系统全盘清零！不管之前多乱，全部归零
-- 不会删除你的历史记录，只会自动插入反向相抵的数据，让所有仓库的所有产品秒变 0。
-- 执行完这个，你再去正常输入你的 Audit 即可！
-- 在 Supabase Dashboard SQL Editor 运行
-- ============================================================

DO $$
DECLARE
    rec RECORD;
    v_count INT := 0;
BEGIN
    -- 找出所有现在数量不是 0 的 产品 和 仓库组合
    FOR rec IN 
        SELECT sku, COALESCE(loc_id, 'Unassigned') as loc, SUM(change_qty) as current_qty
        FROM public.stock_ledger_v2
        GROUP BY sku, loc_id
        HAVING SUM(change_qty) != 0
    LOOP
        -- 插入相反数量，强行让它变 0
        INSERT INTO public.stock_ledger_v2 (
            sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp
        ) VALUES (
            rec.sku, 
            -rec.current_qty, -- 如果是 500 就插入 -500，如果是 -100 就插入 100
            'System Reset', 
            NULLIF(rec.loc, 'Unassigned'), 
            'BIG-RESET-' || to_char(NOW() AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYYMMDD'),
            '全系统大清洗: 历史烂账归零',
            NOW()
        );
        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE '✅ 成功！大清洗完毕！一共清零了 % 个仓库/产品组合的烂账。现在 LiveStock 应该是全 0。', v_count;
END $$;
