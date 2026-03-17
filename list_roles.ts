
import { supabase } from "./src/services/supabase";

async function run() {
    const { data, error } = await supabase.from("sys_users_v2").select("role, employee_id, display_name");
    if (error) {
        console.error("Error:", error);
        return;
    }
    const roles = new Set(data.map(d => d.role));
    console.log("Distinct roles found:", Array.from(roles));
    console.log("Total users:", data.length);
    console.log("Sample users:", data.slice(0, 3));
}
run();

