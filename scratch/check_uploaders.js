import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: photos, error } = await supabase
        .from('work_photos')
        .select('employee_id, employee_name, category, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const uniqueUploaderMap = {};
    photos.forEach(p => {
        const key = `${p.employee_id} - ${p.employee_name}`;
        if (!uniqueUploaderMap[key]) {
            uniqueUploaderMap[key] = { count: 0, categories: new Set(), latest: p.created_at };
        }
        uniqueUploaderMap[key].count++;
        uniqueUploaderMap[key].categories.add(p.category);
    });

    console.log("=== Uploaders in work_photos ===");
    for (const [key, info] of Object.entries(uniqueUploaderMap)) {
        console.log(`${key}: ${info.count} photos, categories: ${Array.from(info.categories).join(', ')}, latest: ${info.latest}`);
    }
}

check();
