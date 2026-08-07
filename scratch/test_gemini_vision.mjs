import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

async function run() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key missing in .env!");
        return;
    }

    try {
        const imagePath = 'C:\\Users\\Max Tan\\.gemini\\antigravity\\brain\\11bed9fc-53f3-4118-b74a-aef9a8690aa7\\media__1781233338202.jpg';
        const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `This image is a photo of a vehicle's dashboard/instrument cluster focusing on the odometer (digital or mechanical mileage display).
Please analyze the image, locate the odometer display (often labeled "ODO" or showing a number followed by "km" or similar digital numbers), and extract the current mileage as a clean integer.

Return a STRICT JSON object:
{
  "mileage": number | null, // The odometer reading as a clean integer (e.g. 95671). If not visible or cannot be determined, return null.
  "confidence": "high" | "medium" | "low", // The confidence level of your reading.
  "reason": "string describing your reasoning or any visual clarity issues"
}

Do not include markdown formatting. Return raw JSON only.`;

        console.log("Calling Gemini API...");
        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        ]);

        const response = await result.response;
        const text = response.text();

        console.log("--- RAW RESPONSE START ---");
        console.log(text);
        console.log("--- RAW RESPONSE END ---");

        const cleanJson = text.replace(/```json|```/g, '').trim();
        console.log("--- CLEAN JSON START ---");
        console.log(cleanJson);
        console.log("--- CLEAN JSON END ---");

        try {
            const parsed = JSON.parse(cleanJson);
            console.log("✅ PARSED SUCCESSFUL:", parsed);
        } catch (err) {
            console.error("❌ PARSE FAILED:", err.message);
        }

    } catch (e) {
        console.error("Error executing vision test:", e);
    }
}

run();
