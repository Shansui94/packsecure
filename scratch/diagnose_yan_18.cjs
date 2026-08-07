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
    const yanDriverId = '06198eb2-7902-4f25-999c-ce00ea0ed037';
    console.log("=== Diagnosing Yan Naing / Driver Yan June 18th activities ===");

    // 1. Search for user activity logs by Yan
    const { data: activities, error: actErr } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', yanDriverId)
        .gte('created_at', '2026-06-18T00:00:00+00:00')
        .lte('created_at', '2026-06-20T00:00:00+00:00')
        .order('created_at', { ascending: true });

    console.log(`User activity logs for Yan between June 18-20: ${activities?.length || 0} rows`);
    if (activities) {
        activities.forEach(a => {
            console.log(`- [${a.created_at}] Action: ${a.action_type || a.action}, Details:`, JSON.stringify(a.details || a.metadata));
        });
    }

    // 2. Search for work photos of DO-yan-260618-002
    const { data: photos, error: photoErr } = await supabase
        .from('work_photos')
        .select('*')
        .eq('ref_id', '0ca2656a-52a7-4995-bd17-72cb9dd9e2e1'); // ID of DO-yan-260618-002

    console.log(`Work photos for order DO-yan-260618-002:`, photos);

    // Let's search work photos for any match containing DO-yan-260618-002 in filename or notes
    const { data: allPhotos, error: allPhotosErr } = await supabase
        .from('work_photos')
        .select('*')
        .ilike('photo_url', '%DO-yan-260618-002%');
    console.log(`Work photos matching URL 'DO-yan-260618-002':`, allPhotos);
}

main().catch(console.error);
