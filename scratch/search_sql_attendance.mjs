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
        } else if (file.endsWith('.sql')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes('operator_attendance')) {
                    results.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
                }
            });
        }
    }
}

searchFiles(searchDir);
console.log("SQL files referencing operator_attendance:");
results.forEach(r => console.log(r));
