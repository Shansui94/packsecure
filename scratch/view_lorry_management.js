import fs from 'fs';

const content = fs.readFileSync('src/pages/LorryManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR .map ===");
lines.forEach((line, index) => {
  if (line.includes('.map(')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
