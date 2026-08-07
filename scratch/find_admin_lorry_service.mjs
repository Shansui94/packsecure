import fs from 'fs';
const file = 'src/App.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('lorry') || line.includes('Lorry') || line.includes('Service')) {
            if (i > 200 && i < 280) {
                console.log(`Line ${i+1}: ${line.trim()}`);
            }
        }
    });
}
