import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const longShifts = [
      {
        "id": "1d53e3f0-8e89-4c04-aaa3-b1996895b683",
        "operator_id": "8138",
        "name": "TUN MIN",
        "machine_id": "N2-M02",
        "clock_in": "2026-06-02T23:59:46.228+00:00",
        "clock_out": "2026-06-04T17:51:48.058+00:00"
      },
      {
        "id": "765c3571-cef3-42e7-9201-2b2f315516f0",
        "operator_id": "0022",
        "name": "Win Htay",
        "machine_id": "T1.3-M02",
        "clock_in": "2026-06-04T14:32:27.916+00:00",
        "clock_out": "2026-06-06T00:01:14.277+00:00"
      },
      {
        "id": "265a8c4d-8969-4bdf-afeb-30c5a71b34cb",
        "operator_id": "8138",
        "name": "TUN MIN",
        "machine_id": "N2-M02",
        "clock_in": "2026-06-04T17:52:06.009+00:00",
        "clock_out": "2026-06-09T15:59:47.231+00:00"
      },
      {
        "id": "b33b4157-ac38-42f6-aed9-c0e2a2cd14dd",
        "operator_id": "8951",
        "name": "Yan Naing",
        "machine_id": "N2-M02",
        "clock_in": "2026-06-03T15:58:48.923+00:00",
        "clock_out": "2026-06-15T09:02:20.542+00:00"
      },
      {
        "id": "c264b3a5-d3b8-4cc2-9fa4-b92be12233ba",
        "operator_id": "6264",
        "name": "NAINE",
        "machine_id": "N2-M02",
        "clock_in": "2026-06-02T23:57:50.597+00:00",
        "clock_out": "2026-06-16T16:53:20.983+00:00"
      }
    ];

    for (const shift of longShifts) {
        console.log(`\n--------------------------------------------`);
        console.log(`Shift ID: ${shift.id} | Operator: ${shift.name} (Emp: ${shift.operator_id}) | Machine: ${shift.machine_id}`);
        console.log(`Clock In: ${shift.clock_in} | Clock Out: ${shift.clock_out}`);
        
        // Fetch production logs for this machine during this period
        const { data: logs, error } = await supabase
            .from('production_logs_v2')
            .select('created_at, output_qty, job_id, operator_id')
            .eq('machine_id', shift.machine_id)
            .gte('created_at', shift.clock_in)
            .lte('created_at', shift.clock_out || new Date().toISOString())
            .order('created_at', { ascending: true });
            
        if (error) {
            console.error("  Error fetching logs:", error);
            continue;
        }
        
        console.log(`  Production logs count: ${logs.length}`);
        if (logs.length > 0) {
            // Group logs by day
            const logsByDay = {};
            logs.forEach(l => {
                const day = new Date(l.created_at).toISOString().slice(0, 10);
                if (!logsByDay[day]) logsByDay[day] = [];
                logsByDay[day].push(l);
            });
            
            Object.keys(logsByDay).forEach(day => {
                const dayLogs = logsByDay[day];
                const totalQty = dayLogs.reduce((sum, l) => sum + Number(l.output_qty), 0);
                const firstLogTime = new Date(dayLogs[0].created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                const lastLogTime = new Date(dayLogs[dayLogs.length - 1].created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.log(`    Day: ${day} | Logs: ${dayLogs.length} | Output: ${totalQty} rolls | Active: ${firstLogTime} - ${lastLogTime}`);
            });
        } else {
            console.log("    No production logs found on this machine during this shift.");
        }
    }
}

run();
