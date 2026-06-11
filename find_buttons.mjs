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
            const hasCuti = content.toLowerCase().includes('cuti');
            const hasAdvance = content.toLowerCase().includes('advance');
            if (hasCuti || hasAdvance) {
                console.log(`File: ${fullPath} | hasCuti: ${hasCuti} | hasAdvance: ${hasAdvance}`);
            }
        }
    }
}

searchDir('.');
console.log("Search finished.");
