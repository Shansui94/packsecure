import fs from 'fs';

const content = fs.readFileSync('src/pages/DriverDelivery.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR handleUnloadPhotoSelect ===");
lines.forEach((line, index) => {
  if (line.includes('handleUnloadPhotoSelect')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});



