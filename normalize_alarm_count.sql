-- ======================================================
-- STEP 1: Check if trigger currently exists
-- ======================================================
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled,
    CASE tgtype & 66
        WHEN 2  THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END AS timing
FROM pg_trigger
WHERE tgrelid = 'public.production_logs'::regclass;

-- ======================================================
-- STEP 2: Drop old and recreate fresh (using SECURITY DEFINER)
-- ======================================================
DROP TRIGGER IF EXISTS normalize_alarm_count_trigger ON public.production_logs;
DROP FUNCTION IF EXISTS public.normalize_alarm_count();

CREATE OR REPLACE FUNCTION public.normalize_alarm_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  correct_yield INTEGER;
BEGIN
  -- If it's a reboot signal (alarm_count = 0), don't modify
  IF NEW.alarm_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Look up yield from machine_active_products (any row for this machine)
  SELECT yield INTO correct_yield
  FROM public.machine_active_products
  WHERE machine_id = NEW.machine_id
  LIMIT 1;

  -- Override alarm_count with the DB yield value
  IF correct_yield IS NOT NULL AND correct_yield > 0 THEN
    NEW.alarm_count := correct_yield;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_alarm_count_trigger
  BEFORE INSERT ON public.production_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_alarm_count();

-- ======================================================
-- STEP 3: Verify it was created
-- ======================================================
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled
FROM pg_trigger
WHERE tgrelid = 'public.production_logs'::regclass;

-- ======================================================
-- STEP 4: Quick sanity test - insert a fake row with alarm_count=99
-- and check what actually gets stored (then delete it)
-- ======================================================
INSERT INTO public.production_logs (machine_id, lane_id, alarm_count)
VALUES ('N1-M01', 'Single', 99)
RETURNING id, alarm_count;

-- Clean up the test row
DELETE FROM public.production_logs
WHERE machine_id = 'N1-M01' AND alarm_count = 99;
