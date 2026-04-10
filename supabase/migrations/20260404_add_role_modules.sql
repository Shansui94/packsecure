-- 1. Add missing column for custom Module Overrides
ALTER TABLE "public"."sys_users_v2" ADD COLUMN IF NOT EXISTS "role_modules" JSONB DEFAULT '[]'::jsonb;

-- 2. Force Supabase API to reload schema cache so the Frontend can see the new column instantly.
NOTIFY pgrst, 'reload schema';
