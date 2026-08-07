import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('.sort(') || line.includes('tripSequence') || line.includes('trip_sequence')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
