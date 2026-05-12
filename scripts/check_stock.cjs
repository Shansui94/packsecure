const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

async function checkStock() {
    const { data, error } = await supabase.rpc('get_live_stock_viewer');
    if (error) {
        console.error("RPC Error:", error);
    } else {
        let total = 0;
        data.forEach(item => total += item.current_stock);
        console.log(`Current Total Stock from RPC: ${total}`);
    }
    
    // Sum of stock_ledger_v2 change_qty
    const { data: ledger, error: lErr } = await supabase.from('stock_ledger_v2').select('change_qty');
    let lTotal = 0;
    ledger.forEach(l => lTotal += l.change_qty);
    console.log(`Total change_qty in ledger: ${lTotal}`);
    
    // Sum of RESTORED
    const { data: restored } = await supabase.from('stock_ledger_v2').select('change_qty').eq('notes', 'Auto-deduct: RESTORED');
    let rTotal = 0;
    restored.forEach(r => rTotal += r.change_qty);
    console.log(`Total RESTORED change_qty: ${rTotal}`);
}

checkStock();
