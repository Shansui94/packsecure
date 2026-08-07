import fs from 'fs';

const content = fs.readFileSync('src/pages/LorryManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR LORRY IMPORT/TYPE ===");
lines.forEach((line, index) => {
  if (line.includes('Lorry') || line.includes('max_volume') || line.includes('handleSubmit')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
