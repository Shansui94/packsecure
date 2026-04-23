import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("Fetching operator attendance...");
    const { data: attendance, error: attError } = await supabase.from('operator_attendance').select('*').order('clock_in', { ascending: true });
    if (attError) { console.error(attError); return; }

    console.log(`Found ${attendance.length} attendance records.`);

    // Group attendance by date for faster lookup
    const attByDate: Record<string, any[]> = {};
    for (const a of attendance) {
        if (!a.clock_in) continue;
        const d = a.clock_in.split('T')[0];
        if (!attByDate[d]) attByDate[d] = [];
        attByDate[d].push(a);
    }

    console.log("Fetching production logs missing operator_id...");
    // Fetch in batches if necessary, but we can try to fetch all or a large chunk
    let allLogs: any[] = [];
    let page = 0;
    while (true) {
        const { data: logs, error: logsError } = await supabase
            .from('production_logs_v2')
            .select('log_id, machine_id, created_at')
            .is('operator_id', null)
            .range(page * 5000, (page + 1) * 5000 - 1)
            .order('created_at', { ascending: true });
        
        if (logsError) { console.error(logsError); break; }
        if (!logs || logs.length === 0) break;
        allLogs = allLogs.concat(logs);
        page++;
    }

    console.log(`Found ${allLogs.length} logs missing operator.`);

    let matched = 0;
    let ambiguous = 0;
    let noMatch = 0;

    const updates: { log_id: string, operator_id: string }[] = [];

    for (const log of allLogs) {
        const logDate = log.created_at.split('T')[0];
        const logTime = new Date(log.created_at).getTime();
        const possibleAtts = attByDate[logDate] || [];

        // Find matching attendance
        const matches = possibleAtts.filter(a => {
            const inTime = new Date(a.clock_in).getTime();
            const outTime = a.clock_out ? new Date(a.clock_out).getTime() : Infinity;
            // 30 min buffer for clock out if they forget to clock out immediately?
            return logTime >= inTime && logTime <= outTime;
        });

        if (matches.length === 1) {
            updates.push({ log_id: log.log_id, operator_id: matches[0].operator_id });
            matched++;
        } else if (matches.length > 1) {
            // Try to filter by machine_id if available
            const exactMachine = matches.filter(a => a.machine_id === log.machine_id);
            if (exactMachine.length === 1) {
                updates.push({ log_id: log.log_id, operator_id: exactMachine[0].operator_id });
                matched++;
            } else {
                ambiguous++;
            }
        } else {
            noMatch++;
        }
    }

    console.log(`Results: Matched=${matched}, Ambiguous=${ambiguous}, NoMatch=${noMatch}`);
    
    // We can just dump the first 5 updates to see
    console.log("Sample updates:", updates.slice(0, 5));
    
    // Output a script that will do the update
    console.log("If this looks good, we can apply the updates.");
}
main();
