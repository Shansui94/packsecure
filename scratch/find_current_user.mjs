import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR currentUser ===");
lines.forEach((line, idx) => {
    if (line.includes('currentUser')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
