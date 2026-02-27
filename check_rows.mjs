import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRows() {
    const email = 'khailoon94@gmail.com';
    const id = 'd1c24ad1-85c2-4f45-9b6d-d3bb36e13390';

    // Check by ID
    const { data: idRows, error: idErr } = await supabaseAdmin.from('users_public').select('*').eq('id', id);
    console.log(`Rows by ID ${id}:`, idRows?.length, idErr);

    // Check by email
    const { data: emailRows, error: emailErr } = await supabaseAdmin.from('users_public').select('*').eq('email', email);
    console.log(`Rows by Email ${email}:`, emailRows?.length, emailErr);

    // What about admin@diyventure.com
    const { data: adminRows } = await supabaseAdmin.from('users_public').select('*').eq('email', 'admin@diyventure.com');
    console.log("admin@diyventure.com rows:", adminRows?.length);

    const { data: maxRows } = await supabaseAdmin.from('users_public').select('*').ilike('email', '%maxtan%');
    console.log("maxtan rows:", maxRows?.length);
}
checkRows();
