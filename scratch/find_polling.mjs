import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('setInterval') || line.includes('setTimeout') || line.includes('channel(') || line.includes('.on(')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
        }
    });
}
