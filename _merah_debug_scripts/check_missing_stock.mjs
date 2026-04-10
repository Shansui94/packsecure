import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMorningAudits() {
    // Today morning (March 31)
    const { data: morningAudits } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Audit Adjustment')
        .gte('timestamp', '2026-03-31T00:00:00.000Z');

    fs.writeFileSync('report.json', JSON.stringify({
        morningAudits: morningAudits || []
    }, null, 2));
}

checkMorningAudits();
