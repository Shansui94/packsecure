import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.');
const sqlFiles = files.filter(f => f.endsWith('.sql'));

console.log("=== SEARCHING SQL FILES FOR STATUS OR STOCK DEDUCTION ===");
sqlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sales_orders') || content.includes('Pending Approval') || content.includes('Delivered')) {
    console.log(`\n--- Found in ${file} ---`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('status') || line.includes('deduct') || line.includes('stock') || line.includes('amendment') || line.includes('Pending Approval')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
