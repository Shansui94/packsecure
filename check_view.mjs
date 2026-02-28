import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

// Read and run the SQL file via rpc
const sql = fs.readFileSync('fix_rolls_per_alarm.sql', 'utf-8');

async function run() {
    // Apply each statement individually
    const stmts = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of stmts) {
        if (stmt.length < 5) continue;
        console.log('Running:', stmt.slice(0, 80).replace(/\n/g, ' ') + '...');
        const { error } = await supabase.rpc('execute_sql', { query: stmt });
        if (error) {
            console.error('  ERROR:', error.message);
        } else {
            console.log('  OK');
        }
    }
}

run();
