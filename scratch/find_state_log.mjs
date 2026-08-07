import fs from 'fs';
import path from 'path';

function searchDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDirectory(fullPath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes('State Log Summary') || content.includes('州属出车与送货明细')) {
                console.log(`Found in: ${fullPath}`);
            }
        }
    }
}

searchDirectory('src');
