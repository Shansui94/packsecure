import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Dry-run: Reconstructing operator_attendance shifts based on production logs...");
    
    // Fetch all June 2026 attendance records
    const { data: att } = await supabase
        .from('operator_attendance')
        .select('*')
        .gte('clock_in', '2026-06-01T00:00:00Z')
        .lt('clock_in', '2026-07-01T00:00:00Z');
        
    // Fetch all users
    const { data: users } = await supabase
        .from('sys_users_v2')
        .select('id, auth_user_id, employee_id, name');

    if (!att || !users) {
        console.error("Failed to load initial data");
        return;
    }

    const longShifts = att.filter(a => {
        if (!a.clock_in) return false;
        const start = new Date(a.clock_in).getTime();
        const end = a.clock_out ? new Date(a.clock_out).getTime() : Date.now();
        return (end - start) / 3600000 > 16;
    });

    console.log(`Found ${longShifts.length} long shifts to process.`);

    for (const shift of longShifts) {
        console.log(`\n============================================`);
        const user = users.find(u => 
            String(u.employee_id).trim() === String(shift.operator_id).trim() ||
            String(u.id).trim() === String(shift.operator_id).trim()
        );
        const uuid = user ? (user.auth_user_id || user.id) : null;
        console.log(`Original Shift: ID: ${shift.id} | Operator: ${user?.name || 'Unknown'} (Emp: ${shift.operator_id})`);
        console.log(`  Clock In: ${shift.clock_in} | Clock Out: ${shift.clock_out || 'Active'}`);
        
        if (!uuid) {
            console.log(`  [Warning] Cannot map operator to UUID. Suggesting fallback: cap to 12 hours.`);
            continue;
        }

        // Fetch production logs
        const { data: logs } = await supabase
            .from('production_logs_v2')
            .select('created_at, output_qty')
            .eq('machine_id', shift.machine_id)
            .eq('operator_id', uuid)
            .gte('created_at', shift.clock_in)
            .lte('created_at', shift.clock_out || new Date().toISOString())
            .order('created_at', { ascending: true });

        if (!logs || logs.length === 0) {
            console.log(`  [Correction] No production logs found. This shift was probably a mistake. Suggestion: Delete or cap to 1 hour.`);
            continue;
        }

        console.log(`  Found ${logs.length} production logs. Grouping into shifts...`);

        // Reconstruct shifts:
        // A shift is a continuous block of logs where the gap between consecutive logs is less than 6 hours.
        const shifts = [];
        let currentShiftLogs = [logs[0]];

        for (let i = 1; i < logs.length; i++) {
            const prevLogTime = new Date(logs[i-1].created_at).getTime();
            const currLogTime = new Date(logs[i].created_at).getTime();
            const gapHours = (currLogTime - prevLogTime) / 3600000;

            if (gapHours > 6) {
                shifts.push(currentShiftLogs);
                currentShiftLogs = [logs[i]];
            } else {
                currentShiftLogs.push(logs[i]);
            }
        }
        shifts.push(currentShiftLogs);

        console.log(`  Reconstructed into ${shifts.length} shifts:`);
        shifts.forEach((shiftLogs, idx) => {
            const firstLog = new Date(shiftLogs[0].created_at);
            const lastLog = new Date(shiftLogs[shiftLogs.length - 1].created_at);
            
            // Pad start/end by 30 mins
            let proposedIn = new Date(firstLog.getTime() - 30 * 60000);
            let proposedOut = new Date(lastLog.getTime() + 30 * 60000);
            
            // Limit shift length to max 12 hours
            const proposedDuration = (proposedOut.getTime() - proposedIn.getTime()) / 3600000;
            if (proposedDuration > 12) {
                // If it exceeds 12 hours, center it around the logs or just set to 12 hours
                proposedOut = new Date(proposedIn.getTime() + 12 * 3600000);
            }
            
            const finalDuration = (proposedOut.getTime() - proposedIn.getTime()) / 3600000;
            const dateStr = proposedIn.toISOString().slice(0, 10);
            
            console.log(`    Shift #${idx+1}:`);
            console.log(`      Logs: ${shiftLogs.length} logs`);
            console.log(`      First Log: ${firstLog.toISOString()}`);
            console.log(`      Last Log: ${lastLog.toISOString()}`);
            console.log(`      Proposed Clock In:  ${proposedIn.toISOString()}`);
            console.log(`      Proposed Clock Out: ${proposedOut.toISOString()}`);
            console.log(`      Calculated Hours:   ${finalDuration.toFixed(2)}h (Date: ${dateStr})`);
        });
    }
}

run();
