-- Create lorry_mileage_logs and lorry_mileage_alerts tables
CREATE TABLE IF NOT EXISTS public.lorry_mileage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lorry_id UUID REFERENCES public.lorries(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.users_public(id) ON DELETE CASCADE NOT NULL,
    mileage INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    log_type TEXT NOT NULL CHECK (log_type IN ('start', 'end')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lorry_mileage_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lorry_id UUID REFERENCES public.lorries(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES public.users_public(id) ON DELETE CASCADE NOT NULL,
    logged_mileage INTEGER NOT NULL,
    expected_mileage INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES public.users_public(id),
    resolved_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lorry_mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lorry_mileage_alerts ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist
DROP POLICY IF EXISTS "Drivers can view their own mileage logs" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Drivers can insert their own mileage logs" ON public.lorry_mileage_logs;
DROP POLICY IF EXISTS "Admins can view and manage all mileage logs" ON public.lorry_mileage_logs;

DROP POLICY IF EXISTS "Drivers can view their own alerts" ON public.lorry_mileage_alerts;
DROP POLICY IF EXISTS "Drivers can insert their own alerts" ON public.lorry_mileage_alerts;
DROP POLICY IF EXISTS "Admins can view and manage all alerts" ON public.lorry_mileage_alerts;

-- Policies for logs
CREATE POLICY "Drivers can view their own mileage logs" ON public.lorry_mileage_logs
FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own mileage logs" ON public.lorry_mileage_logs
FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can view and manage all mileage logs" ON public.lorry_mileage_logs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users_public 
        WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager')
    )
);

-- Policies for alerts
CREATE POLICY "Drivers can view their own alerts" ON public.lorry_mileage_alerts
FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can insert their own alerts" ON public.lorry_mileage_alerts
FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins can view and manage all alerts" ON public.lorry_mileage_alerts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.users_public 
        WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager')
    )
);
