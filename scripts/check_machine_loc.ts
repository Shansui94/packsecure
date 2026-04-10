import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    // Let's check machine_active_products to see what columns it has
    const { data: cols } = await supabase.rpc('query_sql', {
        query: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'machine_active_products'
        `
    });
    console.log("machine_active_products columns:", cols);

    const { data: cols2 } = await supabase.rpc('query_sql', {
        query: `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'machine_configs' OR table_name = 'machines' OR table_name = 'machine_master'
        `
    });
    console.log("Other machine tables:", cols2);

    // If query_sql doesn't work, just try to fetch a row from machine_active_products
    const { data: rows } = await supabase.from('machine_active_products').select('*').limit(1);
    console.log("Row sample:", rows);
}
check().catch(console.error);
