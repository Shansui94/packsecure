import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

console.log("Environment variables defined in .env:");
const file = fs.readFileSync('.env', 'utf-8');
file.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        console.log(`- ${key}: length=${val.length}, prefix=${val.substring(0, 15)}...`);
    }
});
