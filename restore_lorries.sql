-- RESTORE LORRIES TABLE
-- It seems this table was accidentally dropped during legacy cleanup.
-- We are recreating it based on the schema usage in LorryManagement.tsx

CREATE TABLE IF NOT EXISTS public.lorries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plate_number TEXT NOT NULL,
    driver_id UUID REFERENCES public.users_public(id), -- Link to user profile
    driver_name TEXT, -- Cachced name for display (optional, based on usage)
    preferred_zone TEXT DEFAULT 'Not Specified',
    status TEXT DEFAULT 'Available', -- Available, On-Route, Maintenance, Unavailable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lorries ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lorries TO authenticated;
GRANT SELECT ON public.lorries TO anon; -- If needed

-- Policies
CREATE POLICY "Enable all access for authenticated users" ON public.lorries FOR ALL USING (auth.role() = 'authenticated');

-- Insert Sample Data (To restore functionality immediately)
INSERT INTO public.lorries (plate_number, preferred_zone, status)
VALUES 
('VAA 1234', 'North', 'Available'),
('VBB 5678', 'Central', 'On-Route'),
('VCC 9012', 'South', 'Maintenance');
