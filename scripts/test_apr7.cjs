const { config } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const activeEmpId = '0018'; 
    
    const firstDay = '2026-04-01';
    const lastDayStr = '2026-04-30';
    const startDateTs = '2026-04-01T00:00:00.000Z';
    const endDateTs = '2026-04-30T23:59:59.999Z';
    
    const { data: attendanceData } = await supabase
        .from('operator_attendance')
        .select('date, clock_in, clock_out, hours_worked, machine_id')
        .eq('operator_id', activeEmpId)
        .gte('date', firstDay)
        .lte('date', lastDayStr);
        
    const machinesTouched = Array.from(new Set(attendanceData.map(a => a.machine_id).filter(Boolean)));
    
    const { data: rawLogs } = await supabase
        .from('production_logs_v2')
        .select('log_id, created_at, output_qty, reject_qty, machine_id, job_id, operator_id')
        .in('machine_id', machinesTouched)
        .gte('created_at', startDateTs)
        .lte('created_at', endDateTs);
        
    console.log('rawLogs total:', rawLogs.length);
    
    const allLogs = [...rawLogs];
    const logMap = new Map();
    
    allLogs.forEach(log => {
        const uniqueId = log.log_id || (log.created_at + log.machine_id);
        if (logMap.has(uniqueId)) return;
        
        const logTime = new Date(log.created_at).getTime();
        const belongsToMe = attendanceData.some(shift => {
            if (shift.machine_id !== log.machine_id) return false;
            const inTime = new Date(shift.clock_in).getTime();
            const outTime = shift.clock_out ? new Date(shift.clock_out).getTime() : new Date().getTime() + 86400000;
            return logTime >= (inTime - 300000) && logTime <= (outTime + 300000);
        });
        
        if (belongsToMe) {
            logMap.set(uniqueId, log);
        }
    });
    
    const prodData = Array.from(logMap.values());
    console.log('prodData length:', prodData.length);
    
    // Count April 7
    const matchDate = (utcString, targetDateStr) => {
        const d = new Date(utcString);
        const localY = d.getFullYear();
        const localM = String(d.getMonth() + 1).padStart(2, '0');
        const localD = String(d.getDate()).padStart(2, '0');
        return `${localY}-${localM}-${localD}` === targetDateStr;
    };
    
    const apr7Prod = prodData.filter(p => matchDate(p.created_at, '2026-04-07'));
    console.log('April 7 logs assigned to him:', apr7Prod.length);
}
test();
