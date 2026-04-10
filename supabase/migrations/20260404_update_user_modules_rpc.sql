-- RPC to forcefully update a user's role modules bypassing table-level RLS restrictions
CREATE OR REPLACE FUNCTION update_user_modules(p_auth_id UUID, p_role_modules JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE sys_users_v2 
    SET role_modules = p_role_modules 
    WHERE auth_user_id = p_auth_id;
END;
$$;
