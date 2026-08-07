import fs from 'fs';

const file = 'src/pages/DeliveryOrderManagement.tsx';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

console.log("=== Checking Active filter in DeliveryOrderManagement ===");
lines.forEach((line, idx) => {
  if (line.includes('active') || line.includes('Active') || line.includes('status') || line.includes('cancel')) {
    if (line.includes('filter') || line.includes('tab') || line.includes('Tab') || line.includes('const') || line.includes('state')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  }
});
