import fs from 'fs';
import path from 'path';

const dir = '.';
const files = fs.readdirSync(dir);

console.log("Searching for 'employee_leave' in SQL files...");
files.forEach(file => {
    if (!file.endsWith('.sql')) return;
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');
    let found = false;
    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('employee_leave')) {
            if (!found) {
                console.log(`\n=== File: ${file} ===`);
                found = true;
            }
            console.log(`  Line ${index + 1}: ${line.trim().substring(0, 100)}`);
        }
    });
});
