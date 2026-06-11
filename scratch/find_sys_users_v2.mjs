import fs from 'fs';
import path from 'path';

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.git' || file === '.firebase' || file === 'dist' || file === '.vercel') continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('sys_users_v2')) {
                console.log(`Found sys_users_v2 in: ${fullPath}`);
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.includes('CREATE TABLE') || line.includes('sys_users_v2') || line.includes('POLICY') || line.includes('policy') || line.includes('SECURITY')) {
                        console.log(`  ${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Scanning workspace for sys_users_v2...");
scanDir('.');
