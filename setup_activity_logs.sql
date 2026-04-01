-- Create the activity logs table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: user_id is NOT strictly a foreign key to auth.users because we use dummy/demo users and fallback id's in some cases.

-- Enable Row Level Security
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Insert Policy (Anyone logged in can insert)
CREATE POLICY "Allow authenticated insert logs" 
    ON public.user_activity_logs FOR INSERT 
    TO authenticated WITH CHECK (true);

-- 1.b Insert Policy for anon (Fallback for demo accounts)
CREATE POLICY "Allow anon insert logs" 
    ON public.user_activity_logs FOR INSERT 
    TO anon WITH CHECK (true);

-- 2. Select Policy (Users can see their own)
CREATE POLICY "Users can view their own activity logs" 
    ON public.user_activity_logs FOR SELECT 
    USING (auth.uid()::text = user_id::text);

-- 3. Select Policy (SuperAdmin sees all)
-- Assuming sys_users_v2 maps auth_user_id to auth.uid()
CREATE POLICY "SuperAdmin can view all activity logs" 
    ON public.user_activity_logs FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.sys_users_v2 
            WHERE auth_user_id = auth.uid() AND role = 'SuperAdmin'
        )
    );
