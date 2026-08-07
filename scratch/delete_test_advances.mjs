import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const testIds = [
    '2662535f-2f72-41de-8076-747f9975538b',
    'c349ffa8-947b-4725-aa15-19705ecd0388',
    '9184df1f-861c-468e-a7e6-4114236ad777',
    'fa6ef58c-6eeb-4149-a8dd-6df1a5d01db1',
    '2bc761b7-6d2e-4c58-8928-7d290b94d902',
    'f9b89006-5385-470b-81ba-ae5b76669b15',
    'cd7c0c2a-fcc9-4a42-87a6-705596b69665',
    '67c82994-aacd-49fe-bc87-9234b855873f',
    '4ff600c3-71eb-4553-b5f7-8575194c0f71',
    'd8d66627-286b-42d9-a97d-ed858f8cfffb'
];

async function run() {
    console.log(`Starting deletion of ${testIds.length} test records from salary_advances...`);

    const { data, error } = await supabase
        .from('salary_advances')
        .delete()
        .in('id', testIds)
        .select();

    if (error) {
        console.error("Error deleting advances:", error);
        return;
    }

    console.log(`Successfully deleted ${data.length} records.`);
    console.log("Deleted Records detail:");
    data.forEach(r => {
        console.log(`ID: ${r.id} | Amt: ${r.amount} | Date: ${r.bank_in_date} | Status: ${r.status}`);
    });
}

run();
