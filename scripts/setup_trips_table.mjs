import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const sql = `
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_number VARCHAR(64) UNIQUE NOT NULL,
    driver_id UUID,
    vehicle_plate VARCHAR(32),
    vehicle_id UUID,
    trip_origin VARCHAR(32) NOT NULL DEFAULT 'TAIPING',
    zone VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'Planning',
    trip_drop_count INT NOT NULL DEFAULT 1,
    total_rolls INT NOT NULL DEFAULT 0,
    trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE,
    preparation_photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'trips_all_access') THEN
        CREATE POLICY "trips_all_access" ON public.trips FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(64);
`;

async function main() {
    console.log("1. Attempting /pg/query...");
    const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'X-Connection-Encrypted': 'true'
        },
        body: JSON.stringify({ query: sql })
    });

    if (resp.ok) {
        console.log("✅ Success via /pg/query!");
    } else {
        console.log(`❌ /pg/query returned ${resp.status}`);
        
        console.log("2. Attempting RPC exec_sql...");
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql_query: sql, query: sql })
        });
        if (r2.ok) {
            console.log("✅ Success via RPC exec_sql!");
        } else {
            console.log(`❌ RPC returned ${r2.status}`);
        }
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await sb.from('trips').select('*').limit(1);
    if (error) {
        console.log("❌ Table 'trips' verification failed:", error.message);
    } else {
        console.log("🎉 Table 'trips' is VERIFIED and READY! Current count:", data.length);
    }
}

main().catch(console.error);
