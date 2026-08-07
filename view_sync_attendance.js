import fs from 'fs';

const filePath = 'src/pages/ProductionControl.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR syncAttendance in ProductionControl.tsx ===");
lines.forEach((line, index) => {
    if (line.includes('syncAttendance') && (line.includes('const') || line.includes('function') || line.includes(' = '))) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        const start = Math.max(0, index - 5);
        const end = Math.min(lines.length - 1, index + 65);
        console.log("--- CONTEXT ---");
        for (let i = start; i <= end; i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
        console.log("----------------\n");
    }
});
