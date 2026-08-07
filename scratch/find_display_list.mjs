import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('const displayList') || line.includes('let displayList')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
        }
    });
}
