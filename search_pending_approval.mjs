import fs from 'fs';
import path from 'path';

const searchDir = (dir, results = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, results);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (content.includes('Pending Approval')) {
                    results.push(fullPath);
                }
            }
        }
    }
    return results;
};

const results = searchDir('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src');
console.log("Files containing 'Pending Approval':");
results.forEach(r => console.log(`- ${r}`));
