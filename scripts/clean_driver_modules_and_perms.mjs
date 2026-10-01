import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
    console.log("=== 1. Cleaning role_permissions for Driver ===");
    const removePages = ['activity-logs', 'delivery-history', 'driver-leave', 'notes', 'work-photos'];
    
    // Delete unwanted role_permissions
    const { error: delErr } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_name', 'Driver')
        .in('page_id', removePages);
    
    if (delErr) {
        console.error("Error deleting driver permissions:", delErr.message);
    } else {
        console.log(`✅ Removed [${removePages.join(', ')}] from role_permissions for Driver`);
    }

    // Ensure needed pages exist for Driver
    const keepPages = ['delivery-driver', 'leave-calendar', 'personal-report', 'lorry-service'];
    const keepPayloads = keepPages.map(page_id => ({
        role_name: 'Driver',
        page_id,
        allowed: true
    }));
    const { error: upsertErr } = await supabase
        .from('role_permissions')
        .upsert(keepPayloads, { onConflict: 'role_name,page_id' });
    
    if (upsertErr) {
        console.error("Error upserting driver keep permissions:", upsertErr.message);
    } else {
        console.log(`✅ Ensured [${keepPages.join(', ')}] are allowed in role_permissions`);
    }

    // Check resulting role_permissions for Driver
    const { data: currentPerms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_name', 'Driver');
    console.log("Current Driver permissions in DB:", currentPerms?.map(p => p.page_id));

    console.log("\n=== 2. Cleaning sys_users_v2 role_modules for Driver users ===");
    const { data: drivers, error: driverErr } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, name, role, role_modules')
        .eq('role', 'Driver');
    
    if (driverErr) {
        console.error("Error fetching drivers from sys_users_v2:", driverErr.message);
    } else if (drivers) {
        console.log(`Found ${drivers.length} drivers in sys_users_v2.`);
        let updatedCount = 0;
        for (const driver of drivers) {
            const currentMods = driver.role_modules || [];
            // Filter out removePages
            const cleanedMods = currentMods.filter(m => !removePages.includes(m));
            // Always ensure delivery-driver, leave-calendar, personal-report, lorry-service
            for (const needed of keepPages) {
                if (!cleanedMods.includes(needed)) {
                    cleanedMods.push(needed);
                }
            }

            const isDifferent = currentMods.length !== cleanedMods.length || 
                currentMods.some(m => !cleanedMods.includes(m)) ||
                cleanedMods.some(m => !currentMods.includes(m));

            if (isDifferent) {
                console.log(`Updating driver ${driver.name} (${driver.auth_user_id}):`, currentMods, "->", cleanedMods);
                const { error: updateErr } = await supabase
                    .from('sys_users_v2')
                    .update({ role_modules: cleanedMods })
                    .eq('id', driver.id);
                if (updateErr) {
                    console.error(`Failed to update ${driver.name}:`, updateErr.message);
                } else {
                    updatedCount++;
                }
            }
        }
        console.log(`✅ Updated ${updatedCount} drivers' role_modules in sys_users_v2.`);
    }
}

run();
