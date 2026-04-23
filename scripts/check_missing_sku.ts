import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSku() {
    const { data: q1 } = await supabase.from('master_items_v2').select('sku, name').ilike('sku', '%FULL%');
    console.log("SKUs with FULL:", q1);

    const { data: q2 } = await supabase.from('master_items_v2').select('sku, name').ilike('sku', '%HITAM%');
    console.log("SKUs with HITAM:", q2);
    
    const { data: q3 } = await supabase.from('master_items_v2').select('sku, name').ilike('name', '%Black%').ilike('name', '%100cm%');
    console.log("Names with Black and 100cm:", q3);

    const { data: q4 } = await supabase.from('stock_ledger_v2').select('sku').limit(20).order('created_at', { ascending: false });
    console.log("Recent ledger SKUs:", Array.from(new Set(q4?.map(x => x.sku))));
}

checkSku();
