import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
// import multer from 'multer';

// Configure Multer for Vercel (memory storage)
// Vercel functions have size limits, but for reasonable images it should work.
// Note: handling multipart/form-data in Vercel functions can be tricky without Express.
// We might need to use a raw body parser or valid middleware wrapper if using plain functions.
// However, since we are moving from Express, we can use a helper or just parse base64 if the frontend sends base64.
// Looking at the frontend code (UniversalIntake.tsx), it sends JSON with base64 for 'vision' endpoint!
// "body: JSON.stringify({ imageBase64: base64, type: '...' })"
// So we don't need multer for THAT endpoint.
// But wait, server.ts handled /api/analyze-image with multer (multipart) AND /api/agent/vision with JSON/base64.
// Let's check which one is actually used.
// Grep showed: UniversalIntake.tsx calls /api/agent/vision.
// DeliveryOrderManagement.tsx calls /api/agent/vision.
// DataManagement.tsx calls /api/agent/vision.
// It seems /api/analyze-image might be legacy or unused by these main components.
// We will implement the JSON/Base64 version first as it's easier and used by the new components.

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use Standard Flash for better intelligence (Billing Enabled)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Extract customer data from this image (e.g. invoice, delivery order, contact card).
        Return a STRICT JSON ARRAY of objects. 
        Each object must have these keys if found: "name", "phone", "address".
        If there are multiple people/companies, return multiple objects.
        Infer the Zone (North/South/Central/East Malaysia) based on address if possible, key "zone".
        Do not include markdown formatting (like \`\`\`json). Return raw JSON only.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
        ]);

        const response = await result.response;
        const text = response.text();

        if (!text) throw new Error("No data returned from AI");

        const cleanJson = text.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);

        return res.status(200).json(parsedData);

    } catch (e: any) {
        console.error("Vision API Error:", e);
        return res.status(500).json({ error: e.message || "Vision analysis failed" });
    }
}
