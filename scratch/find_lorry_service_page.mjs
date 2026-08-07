import fs from 'fs';
const file = 'src/App.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('LorryService') || line.includes('lorry-service') || line.includes('LorryManagement')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
        }
    });
}
