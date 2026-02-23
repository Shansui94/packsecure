
-- Drop Legacy Tables (UPDATED: Using CASCADE)
-- These tables have been migrated to their V2 counterparts or are obsolete.
-- CASCADE is required to drop tables that are referenced by constraints or views.

BEGIN;

DROP TABLE IF EXISTS "public"."inventory" CASCADE;
DROP TABLE IF EXISTS "public"."lorries" CASCADE;
DROP TABLE IF EXISTS "public"."sys_clients" CASCADE;
DROP TABLE IF EXISTS "public"."suppliers" CASCADE;
DROP TABLE IF EXISTS "public"."machines" CASCADE;
DROP TABLE IF EXISTS "public"."recipes" CASCADE;
DROP TABLE IF EXISTS "public"."bom_recipes" CASCADE;
DROP TABLE IF EXISTS "public"."customers" CASCADE;
-- Also try to drop this one if lingering
DROP TABLE IF EXISTS "public"."inventory_transactions" CASCADE;

-- If 'machine_live_output' was only for legacy machines, it might be orphaned or should be dropped. 
-- Assuming 'sys_machines_v2' uses a new logging table or the same table but with new ID.
-- If 'machine_live_output' uses integer ID and 'sys_machines_v2' uses UUID, then the old data is useless.

COMMIT;

-- Verify they are gone by selecting from information_schema (optional, but good for logs)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('inventory', 'lorries', 'sys_clients', 'suppliers', 'machines', 'recipes', 'bom_recipes', 'customers', 'inventory_transactions');
