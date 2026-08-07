import fs from 'fs';

const files = ['src/pages/ProductionControl.tsx', 'src/pages/FactoryLiveOS.tsx', 'src/pages/MachineLabels.tsx', 'src/pages/HRPortal.tsx'];
for (const file of files) {
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf-8');
    text.split('\n').forEach((line, idx) => {
      if (line.includes('clock_in') || line.includes('scan') || line.includes('Factory') || line.includes('qr') || line.includes('operator')) {
        if (line.includes('machine_id') || line.includes('factory') || line.includes('mode') || line.includes('QR') || line.includes('Scan')) {
          console.log(file, 'L' + (idx+1), line.trim().slice(0, 120));
        }
      }
    });
  }
}
