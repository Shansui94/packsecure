import pg from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const connectionString = 'postgresql://postgres.kdahubyhwndgyloaljak:packsecure2024@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function main() {
    console.log("🔌 Connecting via pooler port 5432...");
    const client = new pg.Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log("✅ Connected successfully!");

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

    console.log("⚡ Executing SQL...");
    await client.query(sql);
    console.log("🎉 Tables mobile_inspection_logs & machine_screw_formulas CREATED SUCCESSFULLY!");
    await client.end();
}

main().catch(console.error);
