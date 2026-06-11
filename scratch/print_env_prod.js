import fs from 'fs';
if (fs.existsSync('.env.production')) {
    console.log("Environment variables defined in .env.production:");
    const file = fs.readFileSync('.env.production', 'utf-8');
    file.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            console.log(`- ${key}: length=${val.length}, prefix=${val.substring(0, 15)}...`);
        }
    });
} else {
    console.log(".env.production does not exist.");
}
