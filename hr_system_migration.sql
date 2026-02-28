-- ============================================================
-- HR System v2 Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add payroll fields to sys_users_v2
ALTER TABLE public.sys_users_v2
  ADD COLUMN IF NOT EXISTS pay_type         TEXT    DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS hourly_rate      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_salary      NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_allowance   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_bonus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attendance_bonus_threshold INTEGER DEFAULT 0;
  -- attendance_bonus_threshold: max absent days still eligible for bonus (0 = perfect attendance only)

-- 2. Create operator_attendance table
CREATE TABLE IF NOT EXISTS public.operator_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id  TEXT NOT NULL,   -- references sys_users_v2.employee_id
  date         DATE NOT NULL,
  clock_in     TIMESTAMPTZ,
  clock_out    TIMESTAMPTZ,
  hours_worked NUMERIC DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, date)
);

-- 3. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  page_id   TEXT NOT NULL,
  allowed   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(role_name, page_id)
);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sys_users_v2'
  AND column_name IN ('pay_type','hourly_rate','base_salary','trip_allowance','attendance_bonus','attendance_bonus_threshold')
ORDER BY column_name;
