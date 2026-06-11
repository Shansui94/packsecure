import fs from 'fs';
import path from 'path';

const files = fs.readdirSync('.');
const sqlFiles = files.filter(f => f.endsWith('.sql'));

console.log("=== SEARCHING SQL FILES FOR sync_order_inventory ===");
sqlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sync_order_inventory')) {
    console.log(`\n--- Found in ${file} ---`);
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('sync_order_inventory') || line.includes('FUNCTION') || line.includes('TRIGGER')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
