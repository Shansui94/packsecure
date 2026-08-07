const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function main() {
    const orderNum = 'DO-yan-260618-002';
    const orderUuid = '0ca2656a-52a7-4995-bd17-72cb9dd9e2e1';

    console.log(`=== Fetching and filtering activity logs locally ===`);
    const { data: logs, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .gte('created_at', '2026-06-19T00:00:00+00:00')
        .lte('created_at', '2026-06-21T00:00:00+00:00');

    if (error) {
        console.error(error);
        return;
    }

    const matches = [];
    logs.forEach(l => {
        const str = JSON.stringify(l).toLowerCase();
        if (str.includes(orderNum.toLowerCase()) || str.includes(orderUuid.toLowerCase())) {
            matches.push(l);
        }
    });

    console.log(`Found ${matches.length} matching log entries:`);
    matches.forEach(l => {
        console.log(`- [${l.created_at}] User: ${l.user_id} | Action: ${l.action_type || l.action} | Details:`, JSON.stringify(l.details || l.metadata));
    });
}

main().catch(console.error);
