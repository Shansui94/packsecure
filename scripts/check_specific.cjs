const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificStock() {
    const { data, error } = await supabase.rpc('get_live_stock_viewer');
    if (error) {
        console.error("RPC Error:", error);
    } else {
        const merah = data.find(d => d.sku.includes('MERAH'));
        const oren = data.find(d => d.sku.includes('OREN'));
        const hitam = data.find(d => d.sku === 'BW-SL-BLK-100Mx100CMx1ROLL-GRN' || d.sku.includes('HITAM-FULL'));
        
        console.log("MERAH stock:", merah ? merah.current_stock : 'Not found');
        console.log("OREN stock:", oren ? oren.current_stock : 'Not found');
        console.log("HITAM stock:", hitam ? hitam.current_stock : 'Not found');
        
        // Find min and max stock
        let min = 999999;
        let max = -999999;
        let minSku = '';
        let maxSku = '';
        
        data.forEach(d => {
            if (d.current_stock < min) { min = d.current_stock; minSku = d.sku; }
            if (d.current_stock > max) { max = d.current_stock; maxSku = d.sku; }
        });
        
        console.log(`Min stock: ${min} (${minSku})`);
        console.log(`Max stock: ${max} (${maxSku})`);
    }
}

checkSpecificStock();
