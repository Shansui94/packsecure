import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR TABS RENDERING ===");
lines.forEach((line, idx) => {
    if (line.includes("id: 'personnel'") || line.includes("id: 'payroll'") || line.includes("id: 'advances'") || line.includes("id: 'permissions'")) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});

console.log("\n=== SCANNING FOR COLUMNS HEADERS ===");
lines.forEach((line, idx) => {
    if (line.includes("Rate / Salary") || line.includes("Pay Type") || line.includes("全勤奖")) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});

console.log("\n=== SCANNING FOR EDIT MODAL FIELDS ===");
lines.forEach((line, idx) => {
    if (line.includes("hourly_rate") || line.includes("base_salary") || line.includes("pay_type") || line.includes("trip_allowance") || line.includes("attendance_bonus")) {
        if (line.includes('<input') || line.includes('<select') || line.includes('<label') || line.includes('onChange') || line.includes('form.')) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    }
});
