import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR OVERLOAD BLOCKS ===");
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('overload')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
