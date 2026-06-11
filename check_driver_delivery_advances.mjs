import * as fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('fetchAdvances') || line.includes('submitAdvance') || line.includes('handleSubmitAdvance')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});

// Let's print lines around fetchAdvances if found
let foundLine = -1;
lines.forEach((line, idx) => {
    if (line.includes('fetchAdvances =') || line.includes('async function fetchAdvances') || line.includes('const fetchAdvances =')) {
        foundLine = idx;
    }
});

if (foundLine !== -1) {
    console.log(`\nFound fetchAdvances around line ${foundLine + 1}`);
    for (let i = foundLine; i < foundLine + 30; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
