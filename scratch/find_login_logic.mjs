import fs from 'fs';
const file = 'src/pages/Login.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('signIn') || line.includes('supabase.auth') || line.includes('PIN') || line.includes('pin')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
        }
    });
}
