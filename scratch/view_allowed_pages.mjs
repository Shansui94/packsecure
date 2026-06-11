import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = Math.max(0, lines.findIndex(l => l.includes('allowedPages')) - 10);
const endIndex = startIndex + 50;

console.log(`=== App.tsx lines ${startIndex + 1} to ${endIndex + 1} ===`);
for (let i = startIndex; i < endIndex; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
