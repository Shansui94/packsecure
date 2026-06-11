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
        } else if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lower = content.toLowerCase();
            if (lower.includes('tripprep') || lower.includes('dailyprep') || lower.includes('daily-prep') || lower.includes('prep-trip') || lower.includes('prep_trip')) {
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes('tripprep') || line.toLowerCase().includes('dailyprep') || line.toLowerCase().includes('prep')) {
                        console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

console.log("Searching for prep page references...");
scanDir('.');
