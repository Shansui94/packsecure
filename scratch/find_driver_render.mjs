import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
        if (line.includes('tasks.map') || line.includes('tasks.filter') || line.includes('DALAM') || line.includes('Dalam')) {
            console.log(`${i+1}: ${line.trim()}`);
        }
    });
}
