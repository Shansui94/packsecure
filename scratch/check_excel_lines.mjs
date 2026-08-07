import fs from 'fs';

const files = ['src/pages/HRPortal.tsx', 'src/pages/PersonalMonthlyReport.tsx'];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  console.log(`=== File: ${file} ===`);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('xlsx') || line.toLowerCase().includes('excel') || line.toLowerCase().includes('export') || line.toLowerCase().includes('download')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
