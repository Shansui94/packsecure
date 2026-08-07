-- Create trips_v2 table
CREATE TABLE IF NOT EXISTS public.trips_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number TEXT UNIQUE NOT NULL,
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    lorry_id UUID REFERENCES public.lorries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Planning', -- Planning, Loading, En-Route, Completed
    start_odometer NUMERIC,
    end_odometer NUMERIC,
    start_odometer_photo_url TEXT,
    end_odometer_photo_url TEXT,
    preparation_photo_url TEXT,
    clerk_reviewed BOOLEAN DEFAULT false,
    clerk_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Enable RLS for trips_v2
ALTER TABLE public.trips_v2 ENABLE ROW LEVEL SECURITY;

-- Policies for trips_v2
CREATE POLICY "Allow read for authenticated" ON public.trips_v2 FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated" ON public.trips_v2 FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated" ON public.trips_v2 FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow delete for authenticated" ON public.trips_v2 FOR DELETE USING (auth.role() = 'authenticated');

-- Create trip_stops_v2 table
CREATE TABLE IF NOT EXISTS public.trip_stops_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips_v2(id) ON DELETE CASCADE,
    sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
    stop_sequence INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, Delivered, Failed
    pod_photo_url TEXT,
    pod_signature_url TEXT,
    pod_signed_by TEXT,
    pod_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for trip_stops_v2
ALTER TABLE public.trip_stops_v2 ENABLE ROW LEVEL SECURITY;

-- Policies for trip_stops_v2
CREATE POLICY "Allow read for authenticated stops" ON public.trip_stops_v2 FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated stops" ON public.trip_stops_v2 FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated stops" ON public.trip_stops_v2 FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow delete for authenticated stops" ON public.trip_stops_v2 FOR DELETE USING (auth.role() = 'authenticated');
