import { createClient } from '@supabase/supabase-js';

// VITE_ prefix is required for Vite env vars
// VITE_ prefix is required for Vite env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or Key. Please check your .env file or Vercel Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
