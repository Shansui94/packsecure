
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from("sys_users_v2").select("role, count", { count: "exact" });
    if (error) console.log(error);
    
    const { data: d2 } = await supabase.from("sys_users_v2").select("role").limit(50);
    const roles = new Set(d2?.map(r => r.role));
    console.log("Found roles:", Array.from(roles));
}
check();

