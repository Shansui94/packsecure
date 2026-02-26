const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
(async () => {
    const { data: logs } = await supabase.from('production_logs').select('*').eq('machine_id', 'N1-M01').order('created_at', { ascending: false }).limit(3);
    console.log(logs);
})();
