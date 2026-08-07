import fs from 'fs';
const file = 'src/pages/DriverDelivery.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('channel') || line.includes('postgres_changes') || line.includes('setInterval') || line.includes('useEffect(')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
        }
    });
}
