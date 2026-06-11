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
        } else if (file.endsWith('.sql')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lower = content.toLowerCase();
            if (lower.includes('not found') || lower.includes('notfound')) {
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes('not found') || line.toLowerCase().includes('notfound')) {
                        console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Searching for 'not found' in SQL files...");
scanDir('.');
