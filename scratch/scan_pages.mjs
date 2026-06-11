import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR PAGE ACCESS IN src/App.tsx ===");
lines.forEach((line, index) => {
    if (line.includes('activePage') || line.includes('page') || line.includes('role') || line.includes('Admin') || line.includes('HRPortal')) {
        if (line.includes('HRPortal') || line.includes('Claims') || line.includes('ExecutiveReports') || line.includes('PersonalMonthlyReport') || line.includes('role')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    }
});
