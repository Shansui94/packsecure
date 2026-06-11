const { config } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixDates() {
    const { data, error } = await supabase.from('operator_attendance').select('id, date, clock_in').gte('clock_in', '2026-01-01');
    if (error) { console.error(error); return; }
    
    let fixedCount = 0;
    for (const row of data) {
        if (!row.clock_in) continue;
        const d = new Date(row.clock_in);
        const localY = d.getFullYear();
        const localM = String(d.getMonth() + 1).padStart(2, '0');
        const localD = String(d.getDate()).padStart(2, '0');
        const correctDate = `${localY}-${localM}-${localD}`;
        
        if (row.date !== correctDate) {
            console.log(`Fixing row ${row.id}: ${row.date} -> ${correctDate} (Clock In: ${row.clock_in})`);
            await supabase.from('operator_attendance').update({ date: correctDate }).eq('id', row.id);
            fixedCount++;
        }
    }
    console.log('Total fixed rows:', fixedCount);
}
fixDates();
