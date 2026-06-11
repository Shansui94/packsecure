import * as fs from 'fs';

const content = fs.readFileSync('src/pages/LeaveCalendar.tsx', 'utf8');
const lines = content.split('\n');
// Find handleSubmitApplication function definition
let foundLine = -1;
lines.forEach((line, idx) => {
    if (line.includes('handleSubmitApplication =')) {
        foundLine = idx;
    }
});

if (foundLine !== -1) {
    console.log(`Found function at line ${foundLine + 1}`);
    const start = foundLine;
    const end = Math.min(lines.length - 1, foundLine + 80);
    for (let i = start; i <= end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
} else {
    console.log("Not found with exact match, let's search just handleSubmitApplication");
    lines.forEach((line, idx) => {
        if (line.includes('handleSubmitApplication') && !line.includes('onSubmit=')) {
            console.log(`Line ${idx + 1}: ${line}`);
        }
    });
}
