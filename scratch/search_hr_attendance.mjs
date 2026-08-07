import fs from 'fs';

const content = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/HRPortal.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('operator_attendance')) {
        console.log(`HRPortal.tsx:${idx + 1}: ${line.trim()}`);
    }
});
