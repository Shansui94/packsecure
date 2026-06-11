import fs from 'fs';
import path from 'path';

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir);

console.log("=== SCANNING MIGRATIONS FOR sys_users_v2 ===");
for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('sys_users_v2')) {
        console.log(`\nFound in: ${file}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            if (line.includes('sys_users_v2') || line.includes('POLICY') || line.includes('policy') || line.includes('RLS') || line.includes('SECURITY')) {
                console.log(`  ${idx + 1}: ${line.trim()}`);
            }
        });
    }
}
