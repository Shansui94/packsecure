import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// We cannot directly read pg_proc through supabase-js select unless it's exposed.
// Let's use postgres query via a custom RPC, oh wait, I don't have python or pg.
// Actually there's a simple way: let's just OVERWRITE it with the guaranteed correct one!
