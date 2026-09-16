import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    console.log("=== Checking sales_orders sample ===");
    const { data: so } = await supabase.from('sales_orders').select('*').limit(1);
    if (so && so.length > 0) {
        console.log("sales_orders columns:", Object.keys(so[0]));
        console.log("sample row:", so[0]);
    }

    console.log("\n=== Checking trips sample ===");
    const { data: tr, error: trErr } = await supabase.from('trips').select('*').limit(1);
    if (trErr) {
        console.log("trips error:", trErr.message);
    } else if (tr && tr.length > 0) {
        console.log("trips columns:", Object.keys(tr[0]));
        console.log("sample row:", tr[0]);
    } else {
        console.log("trips table empty or 0 rows");
    }
}

checkSchema().catch(console.error);
