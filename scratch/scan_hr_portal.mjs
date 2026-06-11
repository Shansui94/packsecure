import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING HRPortal.tsx FOR role, rate, salary, payroll ===");
lines.forEach((line, index) => {
    if (line.includes('role') || line.includes('rate') || line.includes('salary') || line.includes('payroll') || line.includes('Admin') || line.includes('HR')) {
        if (line.includes('Admin') || line.includes('HR') || line.includes('Manager') || line.includes('SuperAdmin') || line.includes('role')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    }
});
