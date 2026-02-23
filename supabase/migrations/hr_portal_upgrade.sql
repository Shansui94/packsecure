-- ============================================================
-- HR Portal Upgrade: Generalized Employee Leave + Payroll
-- ============================================================

-- 1. Create employee_leave table (replaces driver_leave for all roles)
CREATE TABLE IF NOT EXISTS public.employee_leave (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES auth.users(id) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    count_days INTEGER NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create payroll_records table
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES auth.users(id) NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    leave_days_unpaid INTEGER DEFAULT 0,
    deduction NUMERIC(10,2) DEFAULT 0,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),
    UNIQUE (employee_id, month, year)
);

-- 3. Enable RLS
ALTER TABLE public.employee_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- 4. Policies for employee_leave
DROP POLICY IF EXISTS "Employees can view their own leave" ON public.employee_leave;
CREATE POLICY "Employees can view their own leave" ON public.employee_leave
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "Employees can insert their own leave" ON public.employee_leave;
CREATE POLICY "Employees can insert their own leave" ON public.employee_leave
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR and Admins manage all leave" ON public.employee_leave;
CREATE POLICY "HR and Admins manage all leave" ON public.employee_leave
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager', 'HR')
        )
    );

-- 5. Policies for payroll_records
DROP POLICY IF EXISTS "Employees can view their own payroll" ON public.payroll_records;
CREATE POLICY "Employees can view their own payroll" ON public.payroll_records
    FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "HR and Admins manage payroll" ON public.payroll_records;
CREATE POLICY "HR and Admins manage payroll" ON public.payroll_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager', 'HR')
        )
    );

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_employee_leave_employee ON public.employee_leave (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_dates ON public.employee_leave (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_employee_leave_status ON public.employee_leave (status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON public.payroll_records (employee_id, year, month);
