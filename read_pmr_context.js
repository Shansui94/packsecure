import fs from 'fs';

const filePath = 'src/pages/PersonalMonthlyReport.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR PersonalMonthlyReport.tsx lines 250-320 ===");
for (let i = 249; i <= Math.min(lines.length - 1, 320); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
