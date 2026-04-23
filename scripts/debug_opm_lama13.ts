import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    const { data: stock, error } = await supabase.from('v2_inventory_view')
        .select('*')
        .eq('loc_id', 'OPM Lama');
        
    console.log("Error:", error);
    
    let totalStock = 0;
    (stock || []).forEach(item => {
        totalStock += item.current_stock;
        if (item.current_stock > 0 || item.current_stock < 0) {
            console.log(`${item.sku}: ${item.current_stock}`);
        }
    });
    console.log("Total Stock in OPM Lama:", totalStock);
}
main();
