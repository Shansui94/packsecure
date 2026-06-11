const { config } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const activeEmpId = '0018'; 
    const { data: attendanceData } = await supabase
        .from('operator_attendance')
        .select('date, clock_in, clock_out, hours_worked, machine_id')
        .eq('operator_id', activeEmpId)
        .eq('date', '2026-04-07');
        
    const { data: rawLogs } = await supabase
        .from('production_logs_v2')
        .select('*')
        .eq('machine_id', 'T1.2-M01')
        .gte('created_at', '2026-04-06T23:59:00Z')
        .lte('created_at', '2026-04-07T08:00:00Z')
        .limit(1);
        
    const log = rawLogs[0];
    const logTime = new Date(log.created_at).getTime();
    console.log('Log time:', logTime, log.created_at);
    
    const shift = attendanceData[0];
    const inTime = new Date(shift.clock_in).getTime();
    const outTime = shift.clock_out ? new Date(shift.clock_out).getTime() : new Date().getTime() + 86400000;
    
    console.log('inTime:', inTime, shift.clock_in);
    console.log('outTime:', outTime, shift.clock_out);
    
    console.log('logTime >= inTime - 300000:', logTime >= (inTime - 300000));
    console.log('logTime <= outTime + 300000:', logTime <= (outTime + 300000));
}
test();
