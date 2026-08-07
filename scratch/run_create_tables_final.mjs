import pg from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const passwords = ['Neo1994son', 'packsecure2024'];

async function main() {
    for (const host of ['aws-0-ap-southeast-1.pooler.supabase.com', 'db.kdahubyhwndgyloaljak.supabase.co']) {
        for (const port of [6543, 5432]) {
            for (const user of ['postgres.kdahubyhwndgyloaljak', 'postgres']) {
                for (const pass of passwords) {
                    try {
                        console.log(`Connecting to ${host}:${port} user=${user}...`);
                        const client = new pg.Client({ 
                            host,
                            port,
                            user,
                            password: pass,
                            database: 'postgres',
                            ssl: { rejectUnauthorized: false },
                            connectionTimeoutMillis: 3000
                        });
                        await client.connect();
                        console.log(`🎉 CONNECTED! Host=${host}, user=${user}, pass=${pass}`);

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

                        await client.query(sql);
                        console.log("✅ Tables mobile_inspection_logs & machine_screw_formulas CREATED SUCCESSFULLY!");
                        await client.end();
                        return;
                    } catch (e) {
                        // ignore and try next
                    }
                }
            }
        }
    }
    console.log("❌ All connection attempts failed.");
}

main();
