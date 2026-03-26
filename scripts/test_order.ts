import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCols() {
    const { data: o1, error } = await supabase.from('sales_orders').select('*').order('created_at', { ascending: false }).limit(3);
    if (error) console.error(error);
    fs.writeFileSync('test_order.json', JSON.stringify(o1, null, 2));
}

checkCols();
