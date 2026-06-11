import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixAttendance() {
    console.log("Fetching all operator_attendance records...");
    
    // Fetch all records ordered by machine_id and clock_in
    const { data: records, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .order('machine_id', { ascending: true })
        .order('clock_in', { ascending: true });
        
    if (error) {
        console.error("Error fetching records:", error);
        return;
    }
    
    console.log(`Found ${records.length} records. Grouping by machine...`);
    
    // Group by machine_id
    const machines = {};
    for (const r of records) {
        const mid = r.machine_id || 'UNKNOWN';
        if (!machines[mid]) machines[mid] = [];
        machines[mid].push(r);
    }
    
    let updates = [];
    
    for (const mid of Object.keys(machines)) {
        const shifts = machines[mid];
        
        for (let i = 0; i < shifts.length; i++) {
            const current = shifts[i];
            const next = i + 1 < shifts.length ? shifts[i + 1] : null;
            
            const clockInDate = new Date(current.clock_in);
            const maxClockOutDate = new Date(clockInDate.getTime() + 14 * 60 * 60 * 1000); // 14 hours max
            
            let targetClockOutDate = maxClockOutDate;
            let currentClockOutDate = current.clock_out ? new Date(current.clock_out) : null;
            let isModified = false;
            
            if (next) {
                const nextClockInDate = new Date(next.clock_in);
                // If next person logged in before the 14-hour limit, the shift must end when they log in
                if (nextClockInDate < targetClockOutDate) {
                    targetClockOutDate = nextClockInDate;
                }
            }
            
            // If the current clock_out is null, or if the current clock_out is GREATER than the target (meaning they overstayed into someone else's shift)
            if (!currentClockOutDate || currentClockOutDate > targetClockOutDate) {
                const newHoursWorked = Math.max(0, (targetClockOutDate.getTime() - clockInDate.getTime()) / 3600000);
                
                updates.push({
                    id: current.id,
                    operator_id: current.operator_id,
                    old_clock_out: current.clock_out,
                    new_clock_out: targetClockOutDate.toISOString(),
                    new_hours_worked: Math.round(newHoursWorked * 100) / 100,
                    reason: next && new Date(next.clock_in) < maxClockOutDate ? `Cut short by ${next.operator_id} login` : 'Capped at 14h'
                });
            }
        }
    }
    
    console.log(`Found ${updates.length} records that need fixing.`);
    
    // Print the first 10 for review
    console.log(JSON.stringify(updates.slice(0, 10), null, 2));
    
    if (updates.length > 0) {
        console.log("\nApplying fixes to database...");
        for (const u of updates) {
            await supabase.from('operator_attendance').update({
                clock_out: u.new_clock_out,
                hours_worked: u.new_hours_worked,
                notes: u.reason
            }).eq('id', u.id);
            process.stdout.write('.');
        }
        console.log("\nDone!");
    } else {
        console.log("Everything is already clean!");
    }
}

fixAttendance();
