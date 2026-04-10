import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Checking 7629...");
    const { data: o } = await supabase.from('sales_orders').select('status, created_at, updated_at').eq('order_number', 'DO-2026-7629').single();
    console.log("Order 7629 =>", o);

    const { data: l } = await supabase.from('stock_ledger_v2').select('timestamp, created_at, notes, change_qty').eq('ref_doc', 'DO-2026-7629');
    console.log("Ledger 7629 =>", JSON.stringify(l, null, 2));

    const { data: o2 } = await supabase.from('sales_orders').select('status, order_number, created_at').eq('order_number', 'DO-2026-7966').single();
    console.log("Order 7966 =>", o2);

    const { data: l2 } = await supabase.from('stock_ledger_v2').select('timestamp, created_at, notes, change_qty').eq('ref_doc', 'DO-2026-7966');
    console.log("Ledger 7966 =>", JSON.stringify(l2, null, 2));
}

run();
