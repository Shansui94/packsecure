import fs from 'fs';

const filePath = 'c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/ProductionControl.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('&& (') && !line.includes('clockInTime &&') && !line.includes('selectedMachine &&') && !line.includes('user &&')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
