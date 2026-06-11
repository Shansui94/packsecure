import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function restoreAttendance() {
    console.log("Fetching all operator_attendance records...");
    
    const { data: records, error } = await supabase
        .from('operator_attendance')
        .select('*')
        .order('machine_id', { ascending: true })
        .order('clock_in', { ascending: true });
        
    if (error) {
        console.error("Error fetching records:", error);
        return;
    }
    
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
            
            // Check if the record was capped at 14 hours by either the old frontend logic or today's script
            const isCappedByFrontend = current.notes === 'System Auto-Logout' && current.hours_worked >= 13.9;
            const isCappedByScript = current.notes === 'Capped at 14h';
            
            if (isCappedByFrontend || isCappedByScript) {
                let newClockOut = null;
                let newHoursWorked = 0;
                let newNotes = 'Restored to true length';
                
                if (next) {
                    newClockOut = next.clock_in;
                    const msDiff = new Date(newClockOut).getTime() - new Date(current.clock_in).getTime();
                    newHoursWorked = Math.max(0, msDiff / 3600000);
                    newNotes = `Restored (Ended by ${next.operator_id})`;
                } else {
                    // No next person, leave it open (Active)
                    newClockOut = null;
                    newHoursWorked = 0;
                    newNotes = 'Restored (Left Active)';
                }
                
                updates.push({
                    id: current.id,
                    new_clock_out: newClockOut,
                    new_hours_worked: Math.round(newHoursWorked * 100) / 100,
                    new_notes: newNotes,
                    old_hours: current.hours_worked
                });
            }
        }
    }
    
    console.log(`Found ${updates.length} records to restore to >14 hours.`);
    
    if (updates.length > 0) {
        console.log("Sample of updates:");
        console.log(JSON.stringify(updates.slice(0, 5), null, 2));
        
        console.log("\nApplying restoration to database...");
        for (const u of updates) {
            await supabase.from('operator_attendance').update({
                clock_out: u.new_clock_out,
                hours_worked: u.new_hours_worked,
                notes: u.new_notes
            }).eq('id', u.id);
            process.stdout.write('.');
        }
        console.log("\nDone restoring!");
    } else {
        console.log("No 14-hour capped records found to restore.");
    }
}

restoreAttendance();
