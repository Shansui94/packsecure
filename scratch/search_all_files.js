import fs from 'fs';
import path from 'path';

function searchDir(dir, queries) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.cursor') {
                searchDir(fullPath, queries);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            queries.forEach(q => {
                if (content.includes(q)) {
                    console.log(`Found "${q}" in: ${fullPath}`);
                }
            });
        }
    }
}

searchDir('src', ['volume_m3', 'weight_kg']);
