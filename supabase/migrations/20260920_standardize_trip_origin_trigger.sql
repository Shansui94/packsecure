-- Migration: 20260920_standardize_trip_origin_trigger.sql
-- Description: Standardize and enforce trip_origin values ('TAIPING', 'NILAI', 'JOHOR', 'KELANTAN')
-- on both sales_orders and trips_v2 tables using triggers and check constraints.

-- 1. Ensure trips_v2 has trip_origin column
ALTER TABLE public.trips_v2 
ADD COLUMN IF NOT EXISTS trip_origin TEXT DEFAULT 'TAIPING';

-- 2. Backfill existing null or alias records in sales_orders
UPDATE public.sales_orders
SET trip_origin = 
    CASE
        WHEN trip_origin IS NULL OR trim(trip_origin) = '' THEN 'TAIPING'
        WHEN upper(trim(trip_origin)) LIKE '%TAIPING%' OR upper(trim(trip_origin)) IN ('T1', 'SPD', 'OPM', 'OPM LAMA', 'OPM CORNER', 'OPM ALI') THEN 'TAIPING'
        WHEN upper(trim(trip_origin)) LIKE '%NILAI%' OR upper(trim(trip_origin)) = 'N1' THEN 'NILAI'
        WHEN upper(trim(trip_origin)) LIKE '%JOHOR%' OR upper(trim(trip_origin)) IN ('J1', 'JB', 'SENAI') THEN 'JOHOR'
        WHEN upper(trim(trip_origin)) LIKE '%KELANTAN%' OR upper(trim(trip_origin)) IN ('K1', 'KB', 'KOTA BHARU') THEN 'KELANTAN'
        ELSE 'TAIPING'
    END
WHERE trip_origin IS NULL OR trip_origin NOT IN ('TAIPING', 'NILAI', 'JOHOR', 'KELANTAN');

-- 3. Backfill existing null or alias records in trips_v2
UPDATE public.trips_v2
SET trip_origin = 
    CASE
        WHEN trip_origin IS NULL OR trim(trip_origin) = '' THEN 'TAIPING'
        WHEN upper(trim(trip_origin)) LIKE '%TAIPING%' OR upper(trim(trip_origin)) IN ('T1', 'SPD', 'OPM', 'OPM LAMA', 'OPM CORNER', 'OPM ALI') THEN 'TAIPING'
        WHEN upper(trim(trip_origin)) LIKE '%NILAI%' OR upper(trim(trip_origin)) = 'N1' THEN 'NILAI'
        WHEN upper(trim(trip_origin)) LIKE '%JOHOR%' OR upper(trim(trip_origin)) IN ('J1', 'JB', 'SENAI') THEN 'JOHOR'
        WHEN upper(trim(trip_origin)) LIKE '%KELANTAN%' OR upper(trim(trip_origin)) IN ('K1', 'KB', 'KOTA BHARU') THEN 'KELANTAN'
        ELSE 'TAIPING'
    END
WHERE trip_origin IS NULL OR trip_origin NOT IN ('TAIPING', 'NILAI', 'JOHOR', 'KELANTAN');

-- 4. Create trigger function to auto-clean trip_origin before insert/update
CREATE OR REPLACE FUNCTION public.clean_and_normalize_trip_origin()
RETURNS TRIGGER AS $$
DECLARE
    clean_val TEXT;
BEGIN
    IF NEW.trip_origin IS NULL OR trim(NEW.trip_origin) = '' THEN
        NEW.trip_origin := 'TAIPING';
        RETURN NEW;
    END IF;

    clean_val := upper(trim(NEW.trip_origin));

    IF clean_val LIKE '%TAIPING%' OR clean_val IN ('T1', 'SPD', 'OPM', 'OPM LAMA', 'OPM CORNER', 'OPM ALI') THEN
        NEW.trip_origin := 'TAIPING';
    ELSIF clean_val LIKE '%NILAI%' OR clean_val = 'N1' THEN
        NEW.trip_origin := 'NILAI';
    ELSIF clean_val LIKE '%JOHOR%' OR clean_val IN ('J1', 'JB', 'SENAI') THEN
        NEW.trip_origin := 'JOHOR';
    ELSIF clean_val LIKE '%KELANTAN%' OR clean_val IN ('K1', 'KB', 'KOTA BHARU') THEN
        NEW.trip_origin := 'KELANTAN';
    ELSE
        NEW.trip_origin := 'TAIPING';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach triggers to sales_orders
DROP TRIGGER IF EXISTS trg_clean_trip_origin_sales_orders ON public.sales_orders;
CREATE TRIGGER trg_clean_trip_origin_sales_orders
    BEFORE INSERT OR UPDATE OF trip_origin ON public.sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.clean_and_normalize_trip_origin();

-- 6. Attach triggers to trips_v2
DROP TRIGGER IF EXISTS trg_clean_trip_origin_trips_v2 ON public.trips_v2;
CREATE TRIGGER trg_clean_trip_origin_trips_v2
    BEFORE INSERT OR UPDATE OF trip_origin ON public.trips_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.clean_and_normalize_trip_origin();

-- 7. Add check constraints
ALTER TABLE public.sales_orders DROP CONSTRAINT IF EXISTS sales_orders_trip_origin_check;
ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_trip_origin_check
    CHECK (trip_origin IN ('TAIPING', 'NILAI', 'JOHOR', 'KELANTAN'));

ALTER TABLE public.trips_v2 DROP CONSTRAINT IF EXISTS trips_v2_trip_origin_check;
ALTER TABLE public.trips_v2
    ADD CONSTRAINT trips_v2_trip_origin_check
    CHECK (trip_origin IN ('TAIPING', 'NILAI', 'JOHOR', 'KELANTAN'));
