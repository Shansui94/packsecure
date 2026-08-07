import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagementV2.tsx', 'utf-8');

function findRender(content) {
  console.log(`=== Matches for trip labels ===`);
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('1ST TRIP') || line.includes('2ND TRIP') || line.includes('TripBadge') || line.toLowerCase().includes('trip') && line.includes('Badge') || line.includes('tripBadge') || line.includes('trip_sequence')) {
      if (line.trim().length > 0) {
        console.log(`${index + 1}: ${line.trim()}`);
      }
    }
  });
}

findRender(content);
