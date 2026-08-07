-- ============================================================
-- Create audit_logs table and triggers for system change auditing
-- Run this SQL in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by_email TEXT,
    changed_by_uid UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins, SuperAdmins, Managers and HR can read audit logs
DROP POLICY IF EXISTS "Admins and Managers can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins and Managers can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users_public
            WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager', 'HR')
        )
    );

-- Users (even Admins) cannot directly INSERT, UPDATE or DELETE audit logs manually
-- All logging will be handled automatically by SECURITY DEFINER triggers.

-- Create index for quick lookup by table and date
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- ============================================================
-- Create shared PL/pgSQL function to log table changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_email TEXT;
    current_user_uid UUID;
BEGIN
    -- Securely resolve user contexts from JWT
    current_user_uid := auth.uid();
    current_user_email := COALESCE(auth.jwt() ->> 'email', 'System/ServiceRole');

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, changed_by_email, changed_by_uid)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD), NULL, current_user_email, current_user_uid);
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, changed_by_email, changed_by_uid)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, NULL, to_jsonb(NEW), current_user_email, current_user_uid);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Log only if data actually changed
        IF (OLD IS DISTINCT FROM NEW) THEN
            INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, changed_by_email, changed_by_uid)
            VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW), current_user_email, current_user_uid);
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Bind AFTER triggers to target tables
-- ============================================================

-- 1. sales_orders Trigger
DROP TRIGGER IF EXISTS audit_sales_orders_trigger ON public.sales_orders;
CREATE TRIGGER audit_sales_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- 2. salary_advances Trigger
DROP TRIGGER IF EXISTS audit_salary_advances_trigger ON public.salary_advances;
CREATE TRIGGER audit_salary_advances_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.salary_advances
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- 3. users_public Trigger
DROP TRIGGER IF EXISTS audit_users_public_trigger ON public.users_public;
CREATE TRIGGER audit_users_public_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users_public
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();
