-- =================================================================
-- Trigger: sync sys_users_v2 → users_public
-- Note: users_public.id is a FK to auth.users.id
--       so we must use auth_user_id as the id, not gen_random_uuid()
-- =================================================================

-- 1. Trigger function
CREATE OR REPLACE FUNCTION sync_sys_users_to_public()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM users_public WHERE id = OLD.auth_user_id;
        RETURN OLD;
    END IF;

    -- Only sync if we have a valid auth_user_id
    IF NEW.auth_user_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM users_public WHERE id = NEW.auth_user_id) THEN
            UPDATE users_public SET
                name       = NEW.name,
                email      = NEW.email,
                role       = NEW.role,
                phone      = NEW.phone,
                photo_url  = NEW.photo_url,
                status     = NEW.status,
                employee_id = NEW.employee_id,
                updated_at = NOW()
            WHERE id = NEW.auth_user_id;
        ELSE
            INSERT INTO users_public (id, employee_id, name, email, role, phone, photo_url, status, updated_at)
            VALUES (NEW.auth_user_id, NEW.employee_id, NEW.name, NEW.email, NEW.role, NEW.phone, NEW.photo_url, NEW.status, NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger
DROP TRIGGER IF EXISTS trg_sync_users ON sys_users_v2;

CREATE TRIGGER trg_sync_users
AFTER INSERT OR UPDATE OR DELETE
ON sys_users_v2
FOR EACH ROW
EXECUTE FUNCTION sync_sys_users_to_public();

-- =================================================================
-- One-time backfill: only sync rows that have auth_user_id
-- (users_public.id must match auth.users.id)
-- =================================================================
DO $$
DECLARE
    s RECORD;
BEGIN
    FOR s IN
        SELECT * FROM sys_users_v2
        WHERE auth_user_id IS NOT NULL
    LOOP
        IF EXISTS (SELECT 1 FROM users_public WHERE id = s.auth_user_id) THEN
            UPDATE users_public SET
                name        = s.name,
                email       = s.email,
                role        = s.role,
                phone       = s.phone,
                photo_url   = s.photo_url,
                status      = s.status,
                employee_id = s.employee_id,
                updated_at  = NOW()
            WHERE id = s.auth_user_id;
        ELSE
            INSERT INTO users_public (id, employee_id, name, email, role, phone, photo_url, status, updated_at)
            VALUES (s.auth_user_id, s.employee_id, s.name, s.email, s.role, s.phone, s.photo_url, s.status, NOW());
        END IF;
    END LOOP;
END $$;

-- Done!
