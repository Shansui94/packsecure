import pg from 'pg';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const sqlToRun = `
-- 1. Create audit_logs table
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

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at);

-- 2. Create trigger function
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_email TEXT;
    current_user_uid UUID;
BEGIN
    -- Securely resolve user contexts from JWT or default to System/ServiceRole
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
        IF (OLD IS DISTINCT FROM NEW) THEN
            INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data, changed_by_email, changed_by_uid)
            VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW), current_user_email, current_user_uid);
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind triggers to sales_orders
DROP TRIGGER IF EXISTS audit_sales_orders_trigger ON public.sales_orders;
CREATE TRIGGER audit_sales_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- 4. Bind triggers to salary_advances
DROP TRIGGER IF EXISTS audit_salary_advances_trigger ON public.salary_advances;
CREATE TRIGGER audit_salary_advances_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.salary_advances
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- 5. Bind triggers to users_public
DROP TRIGGER IF EXISTS audit_users_public_trigger ON public.users_public;
CREATE TRIGGER audit_users_public_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.users_public
FOR EACH ROW EXECUTE FUNCTION public.log_table_change();
`;

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to Supabase Postgres. Running migration SQL...");
        
        await client.query(sqlToRun);
        
        console.log("Migration SQL ran successfully! Audit logs & triggers deployed.");
    } catch (e) {
        console.error("Failed to run SQL via pg:", e);
    } finally {
        await client.end();
    }
}

run();
