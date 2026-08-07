import fs from 'fs';

const dom1 = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf-8');
const dom2 = fs.readFileSync('src/pages/DeliveryOrderManagementV2.tsx', 'utf-8');

function findMatches(filename, content) {
  console.log(`=== Matches in ${filename} ===`);
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('trip_sequence') || line.includes('onDrag') || line.includes('handleDrag') || line.toLowerCase().includes('reorder')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}

findMatches('DeliveryOrderManagement.tsx', dom1);
findMatches('DeliveryOrderManagementV2.tsx', dom2);
