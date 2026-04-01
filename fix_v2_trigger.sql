-- =================================================================================
-- 紧急修复：恢复机器生产数据自动写入 Live Stock (stock_ledger_v2) 账本的触发器
-- =================================================================================

-- 1. 创建专门用于捕捉 V2 生产数据的 Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_v2_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_factory_id TEXT;
  v_loc_id TEXT;
BEGIN
  -- 如果没拿到产品号，就跳过不报错（防止卡死机器）
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    RETURN NEW;
  END IF;

  -- 查找机台属于哪个厂区
  SELECT factory_id INTO v_factory_id
  FROM public.sys_machines_v2
  WHERE machine_id = NEW.machine_id;

  -- 动态分配：将厂区映射为物理仓库 loc_id（供 Live Stock 筛选）
  IF v_factory_id = 'T1' THEN
      v_loc_id := 'OPM Lama';
  ELSIF v_factory_id = 'N1' OR v_factory_id = 'N2' THEN
      v_loc_id := 'Nilai';
  ELSE
      v_loc_id := 'Unknown';
  END IF;

  -- 强制插入到 stock_ledger_v2 账本
  INSERT INTO public.stock_ledger_v2 (
    sku,
    change_qty,
    event_type,
    loc_id,         -- 核心修复点：这行决定了它会不会显示在 OPM LAMA 下面！
    ref_doc,
    notes,
    timestamp
  ) VALUES (
    NEW.sku,
    COALESCE(NEW.output_qty, 1)::NUMERIC,
    'Production', 
    v_loc_id,       -- 插入仓库位置
    NEW.log_id::text,
    'API-Log: ' || NEW.machine_id,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 清除残留下来的无效绑定
DROP TRIGGER IF EXISTS trg_production_logs_v2_to_ledger ON public.production_logs_v2;

-- 3. 重新绑定扳机！
CREATE TRIGGER trg_production_logs_v2_to_ledger
AFTER INSERT ON public.production_logs_v2
FOR EACH ROW EXECUTE PROCEDURE public.trigger_v2_to_ledger();

-- 运行完毕后，这行保证系统会立即应用！
