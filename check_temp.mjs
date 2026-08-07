import fs from 'fs';

const filePath = 'c:\\Users\\Max Tan\\Downloads\\Packsecure OS\\packsecure\\src\\pages\\HRPortal.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// Find all occurrences of rejection_reason
const regex = /rejection_reason/g;
let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Match at index ${match.index}:`);
  // Get 300 characters before and after
  const start = Math.max(0, match.index - 300);
  const end = Math.min(content.length, match.index + 300);
  console.log(content.substring(start, end));
  console.log('==================================================\n');
}
