const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
CREATE TABLE IF NOT EXISTS public.mobile_inspection_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    log_type TEXT NOT NULL DEFAULT 'material',
    machine_id TEXT,
    machine_name TEXT,
    screw_id TEXT,
    screw_name TEXT,
    material_name TEXT,
    prev_quantity NUMERIC,
    new_quantity NUMERIC,
    unit TEXT,
    photo_url TEXT,
    reaction_notes TEXT,
    temp_zone_1 NUMERIC,
    temp_zone_2 NUMERIC,
    temp_zone_3 NUMERIC,
    temp_die_head NUMERIC,
    temp_status TEXT,
    operator_id TEXT,
    operator_name TEXT,
    operator_role TEXT,
    factory_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mobile_inspection_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mobile_inspection_logs' AND policyname = 'Public all mobile_inspection_logs') THEN
        CREATE POLICY "Public all mobile_inspection_logs" ON public.mobile_inspection_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.machine_screw_formulas (
    machine_id TEXT PRIMARY KEY,
    formula_data JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.machine_screw_formulas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'machine_screw_formulas' AND policyname = 'Public all machine_screw_formulas') THEN
        CREATE POLICY "Public all machine_screw_formulas" ON public.machine_screw_formulas FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

async function main() {
    console.log('Sending SQL to create tables...');
    const res = await fetch(SUPABASE_URL + '/pg/query', {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json',
            'X-Connection-Encrypted': 'true'
        },
        body: JSON.stringify({ query: sql })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
}
main().catch(console.error);
