import fs from 'fs';

const content = fs.readFileSync('src/pages/DataManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR WEIGHT/VOLUME INPUTS ===");
lines.forEach((line, index) => {
  if (line.includes('WEIGHT') || line.includes('VOLUME') || line.includes('volume_') || line.includes('weight_')) {
    const start = Math.max(0, index - 10);
    const end = Math.min(lines.length - 1, index + 15);
    console.log(`--- Match at line ${index + 1} ---`);
    for (let i = start; i <= end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
