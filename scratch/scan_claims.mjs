import fs from 'fs';

const content = fs.readFileSync('src/pages/ClaimsManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING ClaimsManagement.tsx FOR role AND admin ===");
lines.forEach((line, index) => {
    if (line.includes('role') || line.includes('admin') || line.includes('Admin') || line.includes('SuperAdmin')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
