-- ============================================================
-- Create salary_advances table for driver salary advances
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.salary_advances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES auth.users(id) NOT NULL, -- references auth.users(id) (UUID)
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    bank_in_date DATE NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;

-- 1. Drivers can view their own salary advances
DROP POLICY IF EXISTS "Drivers can view their own advances" ON public.salary_advances;
CREATE POLICY "Drivers can view their own advances" ON public.salary_advances
    FOR SELECT USING (auth.uid() = employee_id);

-- 2. Drivers can request their own salary advances
DROP POLICY IF EXISTS "Drivers can insert their own advances" ON public.salary_advances;
CREATE POLICY "Drivers can insert their own advances" ON public.salary_advances
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- 3. HR, Managers, Admins can do everything (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "HR and Admins manage salary advances" ON public.salary_advances;
CREATE POLICY "HR and Admins manage salary advances" ON public.salary_advances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager', 'HR')
        )
    );

-- Create index for quick lookup by driver and date
CREATE INDEX IF NOT EXISTS idx_salary_advances_employee ON public.salary_advances (employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_advances_bank_in_date ON public.salary_advances (bank_in_date);
