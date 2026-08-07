import { createClient } from '@supabase/supabase-js';

// 从配置或硬编码默认地址读取 Supabase 连接
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
