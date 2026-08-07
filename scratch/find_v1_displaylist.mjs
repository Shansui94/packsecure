import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
        if (line.includes('displayList') || line.includes('DALAM') || line.includes('todoList')) {
            console.log(`${i+1}: ${line.trim()}`);
        }
    });
}
