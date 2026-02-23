-- Run this SQL in the Supabase SQL Editor to create a secure delete function
-- This function runs with SECURITY DEFINER so it can delete auth.users

CREATE OR REPLACE FUNCTION public.delete_driver_user(target_uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Step 1: Delete rows with NOT NULL FK constraints
    DELETE FROM public.driver_leave WHERE driver_id = target_uid;
    DELETE FROM public.lorry_service_requests WHERE driver_id = target_uid;

    -- Step 2: Nullify nullable FKs
    UPDATE public.sales_orders SET driver_id = NULL WHERE driver_id = target_uid;
    UPDATE public.lorries SET driver_id = NULL WHERE driver_id = target_uid;
    UPDATE public.claims SET "userId" = NULL WHERE "userId" = target_uid;

    -- Step 3: Delete from users_public
    DELETE FROM public.users_public WHERE id = target_uid;

    -- Step 4: Delete from auth.users (cascades auth.sessions, identities, etc.)
    DELETE FROM auth.users WHERE id = target_uid;
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.delete_driver_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_driver_user(UUID) TO service_role;
