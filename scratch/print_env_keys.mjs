import fs from 'fs';
if (fs.existsSync('.env')) {
    const lines = fs.readFileSync('.env', 'utf-8').split('\n');
    lines.forEach(line => {
        if (line.includes('=')) {
            const key = line.split('=')[0].trim();
            console.log(key);
        }
    });
}
