import * as fs from 'fs';
import * as path from 'path';

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
            searchDir(fullPath);
        } else {
            if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) continue;
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('mohon')) {
                    console.log(`File: ${fullPath} | Line ${idx + 1}: ${line.trim()}`);
                }
            });
        }
    }
}

searchDir('.');
console.log("Search finished.");
