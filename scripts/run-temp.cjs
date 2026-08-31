const fs = require('fs');
let code = fs.readFileSync('scripts/auto-translate.cjs', 'utf8');
code = code.replace(/const filesToProcess = walk\('src'\);/, "const filesToProcess = ['src/components/MachineInspectionModal.tsx'];");
fs.writeFileSync('scripts/auto-translate-temp.cjs', code);
