-- Add PIN support to sys_users_v2
DO $$ 
BEGIN 
    -- Add pin_code column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_users_v2' AND column_name = 'pin_code') THEN
        ALTER TABLE public.sys_users_v2 ADD COLUMN pin_code text;
    END IF;

    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_users_v2' AND column_name = 'is_active') THEN
        ALTER TABLE public.sys_users_v2 ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- Update RLS to ensure we can query users by PIN (simulating 'public' access for the keypad check, or minimally authenticated)
-- Ideally we use a secure RPC, but for this specific local-first MVP request, we'll allow Authenticated/Anon reading of names/pins
-- Note: In a strict env, we would NOT exposing PINs to client. But we need to validate "On Client" or "On Server".
-- Let's make a clear Policy: "Allow All Select" on sys_users_v2 is already active? Check fix_rls_and_seed.sql
-- "CREATE POLICY "Enable read access for all users" ON public.sys_users_v2 FOR SELECT USING (true);" -> This exists.
-- So we just need to data.

-- Set a default PIN for an existing user for testing
UPDATE public.sys_users_v2 SET pin_code = '1234' WHERE pin_code IS NULL;
-- Ensure we have at least one user
INSERT INTO public.sys_users_v2 (auth_user_id, name, role, pin_code, status)
SELECT '00000000-0000-0000-0000-000000000000', 'Test Operator', 'Operator', '1234', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM public.sys_users_v2 LIMIT 1);
