import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data: articles, error } = await supabase
        .from('sop_articles')
        .select('id, title, page_id, target_roles');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("SOP Articles seeded:", articles);
    }
}
run();
