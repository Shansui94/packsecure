-- ============================================================
-- 清理作废单据的错误库存扣除
-- (删除所有已取消单子对应的 Transfer Out 记录)
-- ============================================================

DO $$
DECLARE
    rec RECORD;
    v_count INT := 0;
BEGIN
    FOR rec IN 
        SELECT order_number 
        FROM public.sales_orders
        WHERE status = 'Cancelled'
    LOOP
        DELETE FROM public.stock_ledger_v2 
        WHERE ref_doc = rec.order_number 
          AND event_type = 'Transfer Out';
          
        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE '✅ 成功删除了 % 条属于 Cancelled 订单的多余出库记录！(包含 7629 的多余扣除)', v_count;
END $$;
