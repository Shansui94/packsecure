-- RESTORE LORRIES FINAL (Seed Data + History)

-- 1. Insert known seed data (Found in seed_lorries.cjs)
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
ON CONFLICT DO NOTHING; -- Avoid duplicates if key exists (though no constraint on plate_number yet)

-- 2. Ensure plate_number is unique to prevent future duplicates
ALTER TABLE public.lorries ADD CONSTRAINT unique_plate_number UNIQUE (plate_number);

-- 3. Recover any other vehicles from service history (that are NOT in the seed list)
INSERT INTO public.lorries (plate_number, status, preferred_zone)
SELECT DISTINCT 
    lsr.plate_number, 
    'Available', 
    'Not Specified'
FROM public.lorry_service_requests lsr
WHERE lsr.plate_number IS NOT NULL
ON CONFLICT (plate_number) DO NOTHING;

-- 4. Show final list
SELECT * FROM public.lorries ORDER BY plate_number;
