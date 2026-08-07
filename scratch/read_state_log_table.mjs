import fs from 'fs';
const file = 'src/pages/ProductionReports.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    let foundIndex = -1;
    lines.forEach((line, i) => {
        if (line.includes('州属出车与送货明细') || line.includes('State Log Summary')) {
            foundIndex = i;
        }
    });

    if (foundIndex !== -1) {
        console.log(`Found around line ${foundIndex + 1}`);
        // Print 150 lines starting from foundIndex
        for (let i = foundIndex - 20; i < foundIndex + 150; i++) {
            if (lines[i]) {
                console.log(`${i+1}: ${lines[i]}`);
            }
        }
    } else {
        console.log("Not found.");
    }
}
