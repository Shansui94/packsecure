-- ============================================================
-- SQL: 修改 Live Stock 视图，无视“未来时间”的扣除记录
-- 
-- 效果：司机明天才送货的预扣记录，直到明天 00:00:00 才会反映在
--      当前的库存大屏幕上。这样你盘点和看存货时，看到的是
--      实实在在【此刻】在仓库的数字！
-- ============================================================

DROP VIEW IF EXISTS public.v2_inventory_view CASCADE;

CREATE OR REPLACE VIEW public.v2_inventory_view AS
SELECT 
    m.sku,
    m.name,
    m.type,
    m.uom,
    l.loc_id,
    COALESCE(SUM(l.change_qty), 0) as current_stock,
    MAX(l.timestamp) as last_updated
FROM public.master_items_v2 m
LEFT JOIN public.stock_ledger_v2 l 
    ON m.sku = l.sku 
    -- 核心魔法：只统计 <= 现在时间的记录，完全屏蔽明天及未来的扣除
    AND l.timestamp <= CURRENT_TIMESTAMP
GROUP BY m.sku, m.name, m.type, m.uom, l.loc_id;

-- 恢复用于 Live Stock 显示的 RPC 函数（因为 DROP VIEW CASCADE 可能会把它连带删掉）
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

SELECT '✅ 成功修改！现在的系统只看 [今天为止] 的库存啦！' as status;
