import fs from 'fs';

const content = fs.readFileSync('src/types/index.ts', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR LORRY TYPE ===");
lines.forEach((line, index) => {
  if (line.includes('interface Lorry') || line.includes('type Lorry')) {
    const start = Math.max(0, index - 5);
    const end = Math.min(lines.length - 1, index + 25);
    for (let i = start; i <= end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
