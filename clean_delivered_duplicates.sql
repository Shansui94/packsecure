-- ============================================================
-- 撤销“已送达”订单的补扣记录
-- （因为这 85 个货在跑 Audit 的时候，司机已经搬上车拿走了。
--   所以 Audit 的数量里本来就已经**不包含**这 85 个。
--   如果补救脚本再把它扣一次，就等于双重扣除了！）
-- ============================================================

DO $$
DECLARE
    rec RECORD;
    v_count INT := 0;
BEGIN
    FOR rec IN 
        SELECT so.order_number 
        FROM public.sales_orders so
        WHERE so.status = 'Delivered'
    LOOP
        DELETE FROM public.stock_ledger_v2 
        WHERE ref_doc = rec.order_number 
          AND event_type = 'Transfer Out'
          AND notes LIKE '补救修复:%';
          
        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE '✅ 成功删除了 % 条属于已送达 (Delivered) 订单的重复扣除记录！', v_count;
END $$;
