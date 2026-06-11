import fs from 'fs';

const content = fs.readFileSync('src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR activeTab CONTENT RENDERING ===");
lines.forEach((line, idx) => {
    if (line.includes("activeTab === 'payroll'") || line.includes("activeTab === 'advances'")) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
