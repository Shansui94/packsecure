import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

const terms = ['tamat', 'Tamat', 'selesai', 'Selesai', 'complete', 'Complete', 'finish', 'Finish'];
const matches = [];

lines.forEach((line, idx) => {
    terms.forEach(term => {
        if (line.includes(term) && !matches.includes(idx)) {
            matches.push(idx);
        }
    });
});

console.log(`Found ${matches.length} matches. Showing details:`);
matches.forEach(idx => {
    console.log(`--- Line ${idx + 1} ---`);
    for (let i = Math.max(0, idx - 2); i <= Math.min(lines.length - 1, idx + 2); i++) {
        console.log(`  ${i + 1}: ${lines[i]}`);
    }
});
