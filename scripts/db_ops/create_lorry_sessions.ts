export async function up(supabaseAdmin: any) {
    console.log('Migrating lorry_sessions...');
    const { error } = await supabaseAdmin.rpc('run_sql', {
        query: `
            CREATE TABLE IF NOT EXISTS public.lorry_sessions (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                driver_id UUID REFERENCES auth.users(id),
                lorry_id UUID REFERENCES public.lorries(id),
                start_time TIMESTAMPTZ DEFAULT NOW(),
                end_time TIMESTAMPTZ,
                start_location TEXT,
                end_location TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            ALTER TABLE public.lorry_sessions ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS "Drivers can manage their own sessions" ON public.lorry_sessions;
            CREATE POLICY "Drivers can manage their own sessions" ON public.lorry_sessions
            FOR ALL USING (
                auth.uid() = driver_id 
                OR EXISTS (
                    SELECT 1 FROM public.users_public 
                    WHERE id = auth.uid() AND role IN ('Admin', 'SuperAdmin', 'Manager')
                )
            );
            
            DROP POLICY IF EXISTS "Public select sessions" ON public.lorry_sessions;
            CREATE POLICY "Public select sessions" ON public.lorry_sessions FOR SELECT USING (true);
        `
    });

    if (error && error.code !== 'PGRST202') {
        console.error('Migration failed:', error);
    } else if (error && error.code === 'PGRST202') {
        console.log('run_sql function not found, skipping or needs manual execution...');
    } else {
        console.log('Lorry sessions table ready.');
    }
}
