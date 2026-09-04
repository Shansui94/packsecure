
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '').trim();

console.log(`Testing API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

if (!apiKey) {
    console.error("No API Key found in .env");
    process.exit(1);
}



async function testKey() {
    try {
        console.log("Checking listModels...");
        const testModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
        for (const m of testModels) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Hello" }] }]
                })
            });
            const data = await response.json();
            if (response.ok) {
                console.log(`Model ${m}: ✅ SUCCESS! ->`, data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.slice(0, 30));
            } else {
                console.log(`Model ${m}: ❌ FAILED (${response.status}) - ${data.error?.message?.split('\n')[0]}`);
            }
        }
    } catch (e: any) {
        console.error("Network Error:", e);
    }
}

testKey();
