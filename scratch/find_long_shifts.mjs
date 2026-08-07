import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Scanning operator_attendance for shifts > 16 hours in June 2026...");
    const { data: att, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .gte('clock_in', '2026-06-01T00:00:00Z')
        .lt('clock_in', '2026-07-01T00:00:00Z');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const longShifts = [];
    att.forEach(a => {
        if (!a.clock_in) return;
        const start = new Date(a.clock_in).getTime();
        const end = a.clock_out ? new Date(a.clock_out).getTime() : Date.now();
        const durationHours = (end - start) / 3600000;
        
        if (durationHours > 16) {
            longShifts.push({
                id: a.id,
                operator_id: a.operator_id,
                machine_id: a.machine_id,
                clock_in: a.clock_in,
                clock_out: a.clock_out,
                durationHours: durationHours.toFixed(1),
                hours_worked: a.hours_worked
            });
        }
    });

    console.log(`Found ${longShifts.length} shifts longer than 16 hours:`);
    console.log(JSON.stringify(longShifts, null, 2));
}

run();
