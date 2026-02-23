-- CLEAN TEST LORRIES
-- The user requested to KEEP only "Real Data".
-- We will delete the test entries we manually inserted earlier.

DELETE FROM public.lorries
WHERE plate_number IN ('VAA 1234', 'VBB 5678', 'VCC 9012');

-- Show the final list (Should be only real plates like ANX, NEH, etc.)
SELECT * FROM public.lorries ORDER BY plate_number;
