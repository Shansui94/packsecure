import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("Trying to upsert machine_active_products with a test operator_id...");
    
    // We fetch a real user ID
    const { data: users } = await supabase.from('sys_users_v2').select('id').limit(1);
    if (!users || users.length === 0) {
        console.log("No users found");
        return;
    }
    const testUserId = users[0].id;
    console.log("Using test UUID:", testUserId);

    const { data, error } = await supabase.from('machine_active_products').upsert({
        machine_id: 'TEST-M01',
        lane_id: 'Single',
        product_sku: 'TEST-SKU',
        cutting_size: 100,
        yield: 1,
        operator_id: testUserId,
        updated_at: new Date()
    }, { onConflict: 'machine_id,lane_id' }).select();

    if (error) {
        console.error("Upsert failed:", error);
    } else {
        console.log("Upsert succeeded. Returned data:", data);
    }

    // Clean up
    await supabase.from('machine_active_products').delete().eq('machine_id', 'TEST-M01');
}
main();
