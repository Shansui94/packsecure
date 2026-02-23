-- RECOVER LORRIES FROM SERVICE HISTORY
-- Since the original 'lorries' table was dropped, we will recover the list of vehicles 
-- by scanning the 'lorry_service_requests' table, which contains historical records of plate numbers.

-- 1. Optional: Clear the test data (VAA 1234, etc.)
-- Uncomment the next line if you want to start fresh
-- DELETE FROM public.lorries;

-- 2. Insert unique plate numbers found in service history
INSERT INTO public.lorries (plate_number, status, preferred_zone, created_at)
SELECT DISTINCT 
    lsr.plate_number, 
    'Available' as status, 
    'Not Specified' as preferred_zone,
    NOW() as created_at
FROM public.lorry_service_requests lsr
WHERE lsr.plate_number IS NOT NULL
AND lsr.plate_number NOT IN (SELECT plate_number FROM public.lorries);

-- 3. Show what was recovered
SELECT * FROM public.lorries;
