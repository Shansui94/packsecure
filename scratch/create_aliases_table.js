import pg from 'pg';
const { Client } = pg;

const config = {
    user: 'postgres.kdahubyhwndgyloaljak',
    password: '$QNQ4rAW*#%294z',
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log("Connected to database successfully!");

        // Create product_aliases_v2 table
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.product_aliases_v2 (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                customer TEXT DEFAULT '' NOT NULL,
                alias_name TEXT NOT NULL,
                sku TEXT NOT NULL REFERENCES public.master_items_v2(sku) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (customer, alias_name)
            );
        `);
        console.log("SUCCESS: product_aliases_v2 table created successfully.");

        // Enable Row Level Security
        await client.query(`ALTER TABLE public.product_aliases_v2 ENABLE ROW LEVEL SECURITY;`);
        
        // Add policies
        await client.query(`DROP POLICY IF EXISTS "Allow public read product_aliases" ON public.product_aliases_v2;`);
        await client.query(`CREATE POLICY "Allow public read product_aliases" ON public.product_aliases_v2 FOR SELECT USING (true);`);
        
        await client.query(`DROP POLICY IF EXISTS "Allow auth all product_aliases" ON public.product_aliases_v2;`);
        await client.query(`CREATE POLICY "Allow auth all product_aliases" ON public.product_aliases_v2 FOR ALL WITH CHECK (auth.role() = 'authenticated');`);
        
        console.log("SUCCESS: RLS and policies applied to product_aliases_v2.");
        
    } catch (e) {
        console.error("Database table creation error:", e);
    } finally {
        await client.end();
    }
}

run();
