import fs from 'fs';
const file = 'src/App.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes("case 'maintenance':")) {
            console.log(`Line ${i+1}: ${line.trim()}`);
            for (let j = 1; j <= 5; j++) {
                if (lines[i+j]) console.log(`   +${j}: ${lines[i+j].trim()}`);
            }
        }
    });
}
