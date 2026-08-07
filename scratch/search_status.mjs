import fs from 'fs';
import path from 'path';

const searchDir = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure';
const results = [];

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                searchFiles(fullPath);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes("'status', 'active'") || line.includes('"status", "active"') || line.includes("'status', 'Active'") || line.includes('"status", "Active"')) {
                    results.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
                }
            });
        }
    }
}

searchFiles(searchDir);
console.log("Status queries found:");
results.forEach(r => console.log(r));
