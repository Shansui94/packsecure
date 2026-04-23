import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRates() {
    const { data, error } = await supabase
        .from('delivery_rates')
        .select('*');

    if (error) {
        console.error('Error fetching rates:', error);
    } else {
        const todayStr = '2026-04-10'; // Checking anything matching today or newer
        const addedToday = data.filter(d => d.created_at && d.created_at >= todayStr);
        console.log(`Found ${addedToday.length} records added today (since ${todayStr}):`);
        console.log(addedToday);
        
        // Also just look for any new records by printing the largest created_at
        const maxDate = data.reduce((max, d) => (!max || new Date(d.created_at) > new Date(max)) ? d.created_at : max, null);
        console.log("Max created_at in the whole table:", maxDate);
    }
}

checkRates();
