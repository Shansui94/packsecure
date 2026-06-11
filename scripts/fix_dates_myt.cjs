const { config } = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixDates() {
    let hasMore = true;
    let offset = 0;
    let fixedCount = 0;
    
    while (hasMore) {
        const { data, error } = await supabase
            .from('operator_attendance')
            .select('id, date, clock_in')
            .range(offset, offset + 999);
            
        if (error) { console.error(error); return; }
        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }
        
        for (const row of data) {
            if (!row.clock_in) continue;
            
            const utcDate = new Date(row.clock_in);
            const mytTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
            
            const localY = mytTime.getUTCFullYear();
            const localM = String(mytTime.getUTCMonth() + 1).padStart(2, '0');
            const localD = String(mytTime.getUTCDate()).padStart(2, '0');
            const correctDate = `${localY}-${localM}-${localD}`;
            
            if (row.date !== correctDate) {
                console.log(`Fixing row ${row.id}: ${row.date} -> ${correctDate}`);
                await supabase.from('operator_attendance').update({ date: correctDate }).eq('id', row.id);
                fixedCount++;
            }
        }
        
        offset += 1000;
        if (data.length < 1000) hasMore = false;
    }
    
    console.log('Total fixed rows:', fixedCount);
}
fixDates();
