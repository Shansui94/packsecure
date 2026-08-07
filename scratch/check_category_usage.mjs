import fs from 'fs';

const files = ['src/pages/DeliveryOrderManagement.tsx', 'src/pages/PersonalMonthlyReport.tsx'];
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  console.log(`=== File: ${file} ===`);
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('job_type') || line.toLowerCase().includes('delivery_method') || line.includes('Category') || line.includes('category')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
