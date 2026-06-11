import * as fs from 'fs';

const content = fs.readFileSync('src/pages/LeaveCalendar.tsx', 'utf8');
const lines = content.split('\n');
// Print the leave form implementation. Let's find lines with "Hantar Permohonan Cuti"
let foundLine = -1;
lines.forEach((line, idx) => {
    if (line.includes('Hantar Permohonan Cuti')) {
        foundLine = idx;
    }
});

if (foundLine !== -1) {
    console.log(`Found leave submission around line ${foundLine + 1}`);
    const start = Math.max(0, foundLine - 100);
    const end = Math.min(lines.length - 1, foundLine + 20);
    for (let i = start; i <= end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} else {
    console.log("Not found.");
}
