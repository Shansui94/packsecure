import fs from 'fs';

const v1Content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf-8');
const v2Content = fs.readFileSync('src/pages/DriverDeliveryV2.tsx', 'utf-8');

function findMatches(filename, content) {
  console.log(`=== Matches in ${filename} ===`);
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('trip')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}

findMatches('DriverDelivery.tsx', v1Content);
findMatches('DriverDeliveryV2.tsx', v2Content);
