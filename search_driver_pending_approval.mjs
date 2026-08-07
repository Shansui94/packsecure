import fs from 'fs';

const content = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR 'Pending Approval' in DriverDelivery.tsx ===");
lines.forEach((line, index) => {
  if (line.includes('Pending Approval')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
