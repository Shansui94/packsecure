-- FIX DUPLICATES AND FINALIZE RESTORATION

-- 1. Deduplicate: Keep one record per plate_number (the one created earliest)
DELETE FROM public.lorries
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (partition BY plate_number ORDER BY created_at ASC) AS rnum
        FROM public.lorries
    ) t
    WHERE t.rnum > 1
);

-- 2. Clean up invalid data (Optional: remove entries with empty plate numbers)
DELETE FROM public.lorries WHERE plate_number IS NULL OR plate_number = '';

-- 3. Now safe to add the constraint
ALTER TABLE public.lorries DROP CONSTRAINT IF EXISTS unique_plate_number;
ALTER TABLE public.lorries ADD CONSTRAINT unique_plate_number UNIQUE (plate_number);

-- 4. Upsert Seed Data (ANX 9821, etc.)
-- Now using ON CONFLICT to ignore if they exist
INSERT INTO public.lorries (plate_number, status, preferred_zone)
VALUES 
('ANX 9821', 'Available', 'Any'),
('PETRA 9821', 'Available', 'Any'),
('NEH 9821', 'Available', 'Any'),
('VPC 9821', 'Available', 'Any'),
('TDE 9821', 'Available', 'Any'),
('JYH 9821', 'Available', 'Any'),
('RBC 9821', 'Available', 'Any'),
('DFK 9821', 'Available', 'Any'),
('RAU 9821', 'Available', 'Any'),
('APD 9821', 'Available', 'Any'),
('ANW 9821', 'Available', 'Any')
ON CONFLICT (plate_number) 
DO UPDATE SET 
    preferred_zone = EXCLUDED.preferred_zone,
    status = EXCLUDED.status 
    WHERE public.lorries.status IS NULL; -- Only update if existing status is messy

-- 5. Verify
SELECT * FROM public.lorries ORDER BY plate_number;
