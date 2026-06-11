import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

const hrIndices = [];
lines.forEach((line, idx) => {
    if (line.includes('HRPortal') || line.includes('"hr"') || line.includes("'hr'")) {
        hrIndices.push(idx);
    }
});

console.log("HRPortal references in App.tsx:");
hrIndices.forEach(idx => {
    console.log(`--- Lines around ${idx + 1} ---`);
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 6); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
});
