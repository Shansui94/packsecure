-- ============================================================
-- Update payroll_records and salary_advances RLS policies
-- Restrict global management/viewing to SuperAdmin and HR only.
-- ============================================================

-- 1. payroll_records:
-- Drop existing "HR and Admins manage payroll" policy
DROP POLICY IF EXISTS "HR and Admins manage payroll" ON public.payroll_records;

-- Create new policy allowing only SuperAdmin and HR to perform all actions
CREATE POLICY "HR and SuperAdmin manage payroll" ON public.payroll_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('SuperAdmin', 'HR')
        )
    );

-- 2. salary_advances:
-- Drop existing "HR and Admins manage salary advances" policy
DROP POLICY IF EXISTS "HR and Admins manage salary advances" ON public.salary_advances;

-- Create new policy allowing only SuperAdmin and HR to perform all actions
CREATE POLICY "HR and SuperAdmin manage salary advances" ON public.salary_advances
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('SuperAdmin', 'HR')
        )
    );
