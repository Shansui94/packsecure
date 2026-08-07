const { execSync } = require('child_process');
const fs = require('fs');
try {
    const diff = execSync('git diff src/pages/DeliveryOrderManagement.tsx', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    fs.writeFileSync('scratch/diff_dom.txt', diff);
    console.log('Success, wrote to scratch/diff_dom.txt');
} catch (e) {
    fs.writeFileSync('scratch/diff_dom.txt', e.toString() + '\n' + e.stdout + '\n' + e.stderr);
    console.log('Error, wrote log');
}
