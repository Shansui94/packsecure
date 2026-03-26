import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

async function listModels() {
    console.log("Listing models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            const models = data.models.map((m: any) => m.name);
            console.log("Available models:");
            console.log(models.filter((m: string) => m.includes('embed') || m.includes('vector') || m.includes('flash')));
        } else {
            console.log("API Error:", data);
        }
    } catch(e) {
        console.error("Fetch failed:", e);
    }
}

listModels();
