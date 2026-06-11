import fs from 'fs';
import path from 'path';

const dir = 'supabase/migrations';
const files = fs.readdirSync(dir);

console.log("=== SEARCHING MIGRATIONS FOR sync_order_inventory ===");
files.forEach(file => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
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
