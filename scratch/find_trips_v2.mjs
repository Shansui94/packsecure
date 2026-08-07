import fs from 'fs';
import path from 'path';

const file = 'src/pages/DeliveryOrderManagement.tsx';
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('trips_v2') || line.includes('trip_stops_v2')) {
            console.log(`${i+1}: ${line.trim()}`);
        }
    });
}
