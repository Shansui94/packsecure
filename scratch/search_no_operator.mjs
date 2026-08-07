import fs from 'fs';

const content = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/ProductionControl.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('操作员') || line.includes('Operator') || line.includes('No Operator') || line.includes('未绑定')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
