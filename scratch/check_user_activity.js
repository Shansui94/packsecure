import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("=== Checking user_activity_logs ===");
    try {
        const { data, error } = await supabase
            .from('user_activity_logs')
            .select('*')
            .limit(100);
        
        if (error) {
            console.error("Error:", error.message);
        } else {
            console.log(`Found ${data.length} logs.`);
            if (data.length > 0) {
                console.log("Columns:", Object.keys(data[0]));
                // Filter by any of the 7 order numbers
                const matched = data.filter(l => 
                    JSON.stringify(l).includes('DO-Taufik-260709-001') ||
                    JSON.stringify(l).includes('DO-WAN-260709-001') ||
                    JSON.stringify(l).includes('DO-WAN-260709-002') ||
                    JSON.stringify(l).includes('DO-yan-260709-001') ||
                    JSON.stringify(l).includes('DO-Yashin-260709-001') ||
                    JSON.stringify(l).includes('DO-yan-260709-002') ||
                    JSON.stringify(l).includes('DO-Dean-260709-001')
                );
                console.log("Matched logs:", matched);
            }
        }
    } catch(e) {
        console.error(e.message);
    }
}

check();
