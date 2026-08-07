import fs from 'fs';

const content = fs.readFileSync('c:/Users/Max Tan/Downloads/Packsecure OS/packsecure/src/pages/DeliveryOrderManagement.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== SCANNING FOR tables and queries in DeliveryOrderManagement.tsx ===");
lines.forEach((line, index) => {
  if (line.includes('from(') || line.includes('update(') || line.includes('status ===') || line.includes('status ===')) {
    if (line.includes('supabase') || line.includes('status') || line.includes('from')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
