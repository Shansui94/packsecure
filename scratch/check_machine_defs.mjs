import fs from 'fs';

const files = ['src/pages/HRPortal.tsx', 'src/pages/ProductionControl.tsx', 'src/pages/FactoryLiveOS.tsx', 'src/pages/MachineSchedule.tsx'];
for (const file of files) {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf-8');
    text.split('\n').forEach((line, idx) => {
      if (line.includes('T1') || line.includes('T2') || line.includes('N1') || line.includes('N2')) {
        if (line.length < 150) console.log(file, 'L' + (idx+1), line.trim());
      }
    });
  }
}
