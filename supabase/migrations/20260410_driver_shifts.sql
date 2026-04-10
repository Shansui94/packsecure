-- supabase/migrations/20260410_driver_shifts.sql

-- 1. Create driver_shifts table
CREATE TABLE IF NOT EXISTS public.driver_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES auth.users(id) NOT NULL,
    lorry_id UUID REFERENCES public.lorries(id) NOT NULL,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clock_in_time TIMESTAMPTZ DEFAULT NOW(),
    clock_in_photo_url TEXT,
    clock_out_time TIMESTAMPTZ,
    clock_out_photo_url TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add an index to efficiently query active shifts
CREATE INDEX IF NOT EXISTS idx_driver_shifts_active ON public.driver_shifts(driver_id, status);

-- 3. Enable RLS
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Drivers can read their own shifts
CREATE POLICY "Drivers can view their own shifts" ON public.driver_shifts
FOR SELECT USING (auth.uid() = driver_id);

-- Drivers can create their own shifts
CREATE POLICY "Drivers can start shifts" ON public.driver_shifts
FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own shifts (to Clock Out)
CREATE POLICY "Drivers can end shifts" ON public.driver_shifts
FOR UPDATE USING (auth.uid() = driver_id);

-- Admins can view and manage all shifts
CREATE POLICY "Admins can view and manage all shifts" ON public.driver_shifts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users_public 
        WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager')
    )
);

-- 5. Auto update timestamp
CREATE TRIGGER update_driver_shifts_updated_at BEFORE UPDATE ON public.driver_shifts
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
