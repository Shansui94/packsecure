import fs from 'fs';

const content = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR PIN IN Login.tsx ===");
lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('pin')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
