import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('Amended by Driver') || line.includes('Amended by') || line.includes('Cancelled') || line.includes('cancelled')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
