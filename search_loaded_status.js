import fs from 'fs';
import path from 'path';

const searchDir = (dir, pattern, results = []) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchDir(fullPath, pattern, results);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                if (pattern.test(content)) {
                    results.push(fullPath);
                }
            }
        }
    }
    return results;
};

const files = searchDir('.', /'Loaded'|"Loaded"/);
console.log("Files referencing 'Loaded':");
files.forEach(f => console.log(`- ${f}`));
