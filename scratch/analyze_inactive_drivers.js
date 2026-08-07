import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    const backupFilePath = 'scratch/backup_update_orders_20260728.json';
    if (!fs.existsSync(backupFilePath)) {
        console.error("Backup file not found!");
        return;
    }
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const orders = backupData.orders;

    // Count by driver_id
    const counts = {};
    orders.forEach(o => {
        if (o.driver_id) {
            counts[o.driver_id] = (counts[o.driver_id] || 0) + 1;
        }
    });

    // Fetch driver names
    const { data: drivers, error } = await supabase
        .from('users_public')
        .select('id, name, email')
        .in('id', Object.keys(counts));

    if (error) {
        console.error("Failed to query driver details:", error);
        return;
    }

    const driverMap = {};
    drivers.forEach(d => {
        driverMap[d.id] = {
            name: d.name || d.email || 'Unknown',
            email: d.email
        };
    });

    const result = Object.keys(counts).map(driverId => {
        const info = driverMap[driverId] || { name: 'Unknown (' + driverId + ')', email: '' };
        return {
            name: info.name,
            email: info.email,
            count: counts[driverId]
        };
    }).sort((a, b) => b.count - a.count);

    console.log("Analysis results (Driver name, pending count):");
    console.log(JSON.stringify(result, null, 2));
}

analyze();
