import fs from 'fs';
import path from 'path';

function searchDir(dir, query) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.cursor') {
                searchDir(fullPath, query);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(query)) {
                console.log(`Found in: ${fullPath}`);
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.includes(query)) {
                        console.log(`  L${index + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

searchDir('src', 'calculateLoad');
