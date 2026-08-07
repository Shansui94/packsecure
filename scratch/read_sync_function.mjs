import fs from 'fs';
const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    let startIdx = -1;
    lines.forEach((line, i) => {
        if (line.includes('syncTripsForDriver') && line.includes('async')) {
            startIdx = i;
        }
    });
    if (startIdx !== -1) {
        for (let i = startIdx; i < startIdx + 80; i++) {
            console.log(`${i+1}: ${lines[i]}`);
        }
    } else {
        console.log("syncTripsForDriver not found");
    }
}
