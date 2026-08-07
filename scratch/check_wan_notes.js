import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWanNotes() {
    console.log("Checking user profile notes for WAN...");
    const { data: profile, error } = await supabase
        .from('users_public')
        .select('name, email, notes')
        .eq('email', 'wan.2134@packsecure.com')
        .single();

    if (error) {
        console.error(error);
        return;
    }
    console.log("WAN Profile:", profile);
}

checkWanNotes();
