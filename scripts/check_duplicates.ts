import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    // 检查最近的 Transfer Out
    const { data: records, error } = await supabase
        .from('stock_ledger_v2')
        .select('*')
        .eq('event_type', 'Transfer Out')
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!records || records.length === 0) {
        console.log("No Transfer Out records found recently.");
        return;
    }

    // 分组查看是否有相同的 DO 被扣了两次
    const map = new Map<string, any[]>();
    for (const r of records) {
        const key = `${r.ref_doc} | ${r.sku}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
    }

    for (const [key, rows] of map.entries()) {
        if (rows.length > 1) {
            console.log(`⚠️ DUPLICATE FOUND for [${key}]:`);
            console.log(rows.map(r => `   ID: ${r.id}, Qty: ${r.change_qty}, Notes: ${r.notes}`).join('\n'));
        } else {
            console.log(`✅ OK: [${key}] -> Qty: ${rows[0].change_qty}, Notes: ${rows[0].notes}`);
        }
    }
}

run();
