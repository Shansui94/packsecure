import fs from 'fs';

const content = fs.readFileSync('src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== STATUS FILTER TABS ===");
lines.forEach((line, index) => {
  if (line.includes('setStatusFilter') || line.includes('statusFilter ===')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
