-- Migration: Switch from zone_trip_rates to delivery_rates (Origin-based)

-- 1. Create the new rates table
CREATE TABLE IF NOT EXISTS public.delivery_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    origin VARCHAR NOT NULL DEFAULT 'TAIPING',
    location_name VARCHAR NOT NULL,
    base_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_places INTEGER NOT NULL DEFAULT 0,
    extra_rate_per_place NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(origin, location_name)
);

-- 2. Add some comments for clarity
COMMENT ON TABLE public.delivery_rates IS 'Driver payroll rates based on origin and destination locations.';

-- 3. Insert the provided rates from the user (Origin: TAIPING)
INSERT INTO public.delivery_rates (origin, location_name, base_rate, max_places, extra_rate_per_place) VALUES
('TAIPING', 'IPOH', 80, 3, 5),
('TAIPING', 'SITIAWAN', 80, 3, 5),
('TAIPING', 'BM', 80, 3, 5),
('TAIPING', 'PENANG', 80, 3, 5),
('TAIPING', 'KULIM', 80, 3, 5),
('TAIPING', 'SIMPANG AMPAT (PENANG)', 80, 3, 5),
('TAIPING', 'SUNGAI PETANI', 100, 3, 5),
('TAIPING', 'BEDONG', 100, 3, 5),
('TAIPING', 'PENDANG', 100, 3, 5),
('TAIPING', 'SIMPANG EMPAT (KEDAH)', 100, 3, 5),
('TAIPING', 'JITRA', 150, 3, 5),
('TAIPING', 'ALOR SETAR', 150, 3, 5),
('TAIPING', 'BALING', 150, 3, 5),
('TAIPING', 'SIK', 150, 3, 5),
('TAIPING', 'KEDAH', 150, 3, 5),
('TAIPING', 'ARAU', 165, 3, 5),
('TAIPING', 'KANGAR', 165, 3, 5),
('TAIPING', 'BUKIT KAYU HITAM', 165, 3, 5),
('TAIPING', 'KUALA PERLIS', 165, 3, 5),
('TAIPING', 'PADANG BESAR', 165, 3, 5),
('TAIPING', 'TELUK INTAN', 100, 3, 5),
('TAIPING', 'TANJUNG MALIM', 100, 3, 5),
('TAIPING', 'SUNGKAI', 100, 3, 5),
('TAIPING', 'KL', 330, 3, 10),
('TAIPING', 'KL (1 TEMPAT)', 250, 0, 0),
('TAIPING', 'NEGERI SEMBILAN', 400, 3, 15),
('TAIPING', 'KELANTAN', 380, 3, 15),
('TAIPING', 'BESUT', 430, 3, 15),
('TAIPING', 'KUALA TERENGGANU', 480, 3, 15),
('TAIPING', 'AMBIK PALLET', 10, 0, 0),
('TAIPING', 'LORRY SERVICE', 15, 0, 0),
('TAIPING', 'OPM - SHOPEE/SPD', 120, 0, 0),
('TAIPING', 'FULL DAY SHOPEE', 800, 0, 0)
ON CONFLICT (origin, location_name) 
DO UPDATE SET 
    base_rate = EXCLUDED.base_rate,
    max_places = EXCLUDED.max_places,
    extra_rate_per_place = EXCLUDED.extra_rate_per_place;

-- 4. Enable RLS and setup policies
ALTER TABLE public.delivery_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.delivery_rates
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.delivery_rates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.delivery_rates
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.delivery_rates
    FOR DELETE USING (auth.role() = 'authenticated');

-- 5. Add origin and drop_count to sales_orders if missing
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS trip_origin VARCHAR DEFAULT 'TAIPING';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS trip_drop_count INTEGER DEFAULT 1;

-- To prevent query errors since we are using 'zone' interchangeably with 'trip_location' for now
-- we can just keep using `zone` or add `trip_location` explicitly
-- We'll keep using `zone` as the selected 'location_name' to avoid breaking old data queries,
-- but we'll add 'trip_drop_count' for the calculation.
