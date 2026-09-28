import { createClient } from '@supabase/supabase-js';

// VITE_ prefix is required for Vite env vars
const env: Record<string, any> = (typeof import.meta !== 'undefined' && (import.meta as any).env) 
    ? (import.meta as any).env 
    : (typeof process !== 'undefined' && process.env ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or Key. Please check your .env file or Vercel Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
