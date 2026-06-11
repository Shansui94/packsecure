-- ==========================================
-- 1. 薪资底层：机器单价表
-- ==========================================
CREATE TABLE IF NOT EXISTS public.machine_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id TEXT UNIQUE NOT NULL,
    operator_hourly_rate NUMERIC(10,2) DEFAULT 0,
    manager_piece_rate NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. 薪资账本：弹性薪资单 (Draft & Approved)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.payroll_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    role TEXT,
    shift_date DATE NOT NULL,
    shift_type TEXT,
    machine_id TEXT,
    hours_worked NUMERIC(10,2) DEFAULT 0,
    rolls_produced INTEGER DEFAULT 0,
    calc_mode TEXT DEFAULT 'hourly', -- 'hourly' or 'piece'
    base_amount NUMERIC(10,2) DEFAULT 0,
    multiplier NUMERIC(10,2) DEFAULT 1.0,
    final_amount NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'draft', -- 'draft' or 'approved'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, shift_date, shift_type)
);

-- 开启行级安全策略 (RLS)
ALTER TABLE public.machine_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_drafts ENABLE ROW LEVEL SECURITY;

-- 临时为 Admin/所有登录用户放开权限 (可根据实际需求调整)
CREATE POLICY "Enable all for authenticated users" ON public.machine_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON public.payroll_drafts FOR ALL USING (true) WITH CHECK (true);

-- 插入默认的机器计费数据 (Demo Data)
INSERT INTO public.machine_rates (machine_id, operator_hourly_rate, manager_piece_rate) VALUES
('T1.1-M03', 10.00, 0.50),
('T1.2-M01', 12.00, 0.80),
('T1.3-M02', 8.00, 0.40),
('N1-M01', 15.00, 1.20)
ON CONFLICT (machine_id) DO UPDATE 
SET operator_hourly_rate = EXCLUDED.operator_hourly_rate, 
    manager_piece_rate = EXCLUDED.manager_piece_rate;


-- ==========================================
-- 3. 订单权限修复：允许查看未分配(Unassigned)订单
-- ==========================================
CREATE POLICY "Enable read access for unassigned orders"
ON "public"."sales_orders"
AS PERMISSIVE
FOR SELECT
TO public
USING (driver_id IS NULL);

-- 司机专属查看未分配订单 (如果上面的策略不够精确，这个作为备选方案)
create policy "Drivers can see unassigned orders" on sales_orders
for select
to authenticated
using (
  auth.uid() = driver_id OR driver_id IS NULL
);
