const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    console.log("=== STARTING MACHINE DATABASE MIGRATION ===");

    // 1. Insert new machines for Kelantan, Johor and Nilai N3
    console.log("Inserting new machines (K1, J1, N3)...");
    const newMachines = [
        { machine_id: 'K1-M01', name: '1M Double Layer (K1)', type: 'Extruder', factory_id: 'K1', status: 'Idle', base_width: 100, rolls_per_alarm: 1 },
        { machine_id: 'J1-M01', name: '2M Double Layer (J1)', type: 'Extruder', factory_id: 'J1', status: 'Idle', base_width: 200, rolls_per_alarm: 2 },
        { machine_id: 'N3-M03', name: 'Recycle Machine (N3)', type: 'Recycle', factory_id: 'N3', status: 'Idle', base_width: 100, rolls_per_alarm: 1 }
    ];

    for (const mac of newMachines) {
        const { error } = await supabase.from('sys_machines_v2').upsert(mac);
        if (error) {
            console.error(`Failed to upsert new machine ${mac.machine_id}:`, error.message);
            throw error;
        } else {
            console.log(`Successfully added/updated machine: ${mac.machine_id}`);
        }
    }

    // 2. Insert new Taiping machine records T1-T5 (so child records can reference them during updates)
    console.log("Inserting new Taiping machine records (T1, T2, T3, T4, T5)...");
    const taipingNew = [
        { machine_id: 'T1-M03', name: 'Stretch Film (T1)', type: 'Extruder', factory_id: 'T1', status: 'Idle', base_width: 50, rolls_per_alarm: 2 },
        { machine_id: 'T2-M01', name: '2M Double Layer (T2)', type: 'Extruder', factory_id: 'T1', status: 'Idle', base_width: 200, rolls_per_alarm: 2 },
        { machine_id: 'T3-M02', name: '1M Single Layer (T3)', type: 'Extruder', factory_id: 'T1', status: 'Idle', base_width: 100, rolls_per_alarm: 1 },
        { machine_id: 'T4-M04', name: 'Stretch Film (T4)', type: 'Extruder', factory_id: 'T1', status: 'Idle', base_width: 50, rolls_per_alarm: 2 },
        { machine_id: 'T5-M05', name: 'Recycle Machine (T5)', type: 'Recycle', factory_id: 'T1', status: 'Idle', base_width: 100, rolls_per_alarm: 1 }
    ];

    for (const mac of taipingNew) {
        const { error } = await supabase.from('sys_machines_v2').upsert(mac);
        if (error) {
            console.error(`Failed to upsert Taiping machine ${mac.machine_id}:`, error.message);
            throw error;
        } else {
            console.log(`Successfully added/updated Taiping machine: ${mac.machine_id}`);
        }
    }

    // 3. Update referencing child records from old IDs to new IDs
    const renameMapping = [
        { oldId: 'T1.1-M03', newId: 'T1-M03' },
        { oldId: 'T1.2-M01', newId: 'T2-M01' },
        { oldId: 'T1.3-M02', newId: 'T3-M02' },
        { oldId: 'T1.4-M04', newId: 'T4-M04' }
    ];

    const tablesToMigrate = [
        { name: 'operator_attendance', field: 'machine_id' },
        { name: 'production_logs_v2', field: 'machine_id' },
        { name: 'machine_active_products', field: 'machine_id' },
        { name: 'iot_device_configs', field: 'machine_id' }
    ];

    for (const map of renameMapping) {
        console.log(`Migrating child records from ${map.oldId} to ${map.newId}...`);
        for (const table of tablesToMigrate) {
            const { data, error } = await supabase
                .from(table.name)
                .update({ [table.field]: map.newId })
                .eq(table.field, map.oldId);

            if (error) {
                console.error(`❌ Failed to update ${table.name} from ${map.oldId} to ${map.newId}:`, error.message);
                throw error;
            } else {
                console.log(`✅ Successfully updated ${table.name} from ${map.oldId} to ${map.newId}`);
            }
        }
    }

    // 4. Delete the old Taiping machine records from sys_machines_v2
    console.log("Deleting old Taiping machine records from sys_machines_v2...");
    const oldMachineIds = ['T1.1-M03', 'T1.2-M01', 'T1.3-M02', 'T1.4-M04'];
    for (const oldId of oldMachineIds) {
        const { error } = await supabase
            .from('sys_machines_v2')
            .delete()
            .eq('machine_id', oldId);

        if (error) {
            console.error(`❌ Failed to delete old machine ${oldId}:`, error.message);
            throw error;
        } else {
            console.log(`✅ Successfully deleted old machine ${oldId} from sys_machines_v2`);
        }
    }

    console.log("=== MACHINE DATABASE MIGRATION COMPLETED SUCCESSFULLY ===");
}

main().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
