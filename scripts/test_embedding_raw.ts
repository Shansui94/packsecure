import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

async function testEmbedding() {
    console.log("Testing raw fetch...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
    
    // According to Google API docs, payload is {"model": "models/text-embedding-004", "content": {"parts": [{"text": "Hello world"}]}}
    const payload = {
        model: "models/text-embedding-004",
        content: {
            parts: [{ text: "Hello world" }]
        }
    };
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log("Success! Embedding length:", data.embedding?.values?.length);
        } else {
            console.log("API Error:", data);
        }
    } catch(e) {
        console.error("Fetch failed:", e);
    }
}

testEmbedding();
