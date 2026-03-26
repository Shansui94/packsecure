import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = 'https://kdahubyhwndgyloaljak.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODY4ODksImV4cCI6MjA4MDk2Mjg4OX0.mzTtQ6zpfvRY07372UH_M4dvKPzHBDkiydwosUYPs-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testDriver() {
    const ayamAuth = 'ffeb9b0a-0d32-41f2-ba81-f2257ba45c17';

    const { data: o1 } = await supabase.from('sales_orders').select('id, order_number, status, order_date, pod_timestamp').eq('driver_id', ayamAuth).limit(10);
    
    fs.writeFileSync('test_out2.json', JSON.stringify(o1, null, 2));
}

testDriver();
