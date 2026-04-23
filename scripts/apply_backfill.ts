import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
    console.log("Fetching operator attendance and users...");
    const { data: users, error: userError } = await supabase.from('sys_users_v2').select('id, employee_id');
    if (userError) { console.error(userError); return; }

    const userMap = new Map();
    users.forEach(u => userMap.set(u.employee_id, u.id));

    const { data: attendance, error: attError } = await supabase.from('operator_attendance').select('*').order('clock_in', { ascending: true });
    if (attError) { console.error(attError); return; }

    const attByDate: Record<string, any[]> = {};
    for (const a of attendance) {
        if (!a.clock_in) continue;
        const realUserId = userMap.get(a.operator_id);
        if (!realUserId) continue; // Skip if we can't map the 4-digit PIN to a UUID

        // Replace the 4-digit operator_id with the UUID
        a.operator_id = realUserId;

        const d = a.clock_in.split('T')[0];
        if (!attByDate[d]) attByDate[d] = [];
        attByDate[d].push(a);
    }

    console.log("Fetching production logs missing operator_id...");
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
        console.log(`Fetched ${allLogs.length} logs...`);
    }

    const updates: { log_id: string, operator_id: string }[] = [];

    for (const log of allLogs) {
        const logDate = log.created_at.split('T')[0];
        const logTime = new Date(log.created_at).getTime();
        const possibleAtts = attByDate[logDate] || [];

        const matches = possibleAtts.filter(a => {
            const inTime = new Date(a.clock_in).getTime();
            const outTime = a.clock_out ? new Date(a.clock_out).getTime() : Infinity;
            return logTime >= inTime && logTime <= outTime;
        });

        if (matches.length === 1) {
            updates.push({ log_id: log.log_id, operator_id: matches[0].operator_id });
        } else if (matches.length > 1) {
            const exactMachine = matches.filter(a => a.machine_id === log.machine_id);
            if (exactMachine.length === 1) {
                updates.push({ log_id: log.log_id, operator_id: exactMachine[0].operator_id });
            }
        }
    }

    console.log(`Found ${updates.length} resolvable logs to update.`);

    // Batch update function
    const batchSize = 100; // Small batch to avoid overwhelming connection pool
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        console.log(`Updating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(updates.length/batchSize)}...`);
        
        const promises = batch.map(u => 
            supabase.from('production_logs_v2')
                .update({ operator_id: u.operator_id })
                .eq('log_id', u.log_id)
        );

        const results = await Promise.all(promises);
        results.forEach(r => {
            if (r.error) {
                console.error("Update failed:", r.error);
                failCount++;
            } else {
                successCount++;
            }
        });
    }

    console.log(`DONE. Successfully updated: ${successCount}. Failed: ${failCount}`);
}

main();
