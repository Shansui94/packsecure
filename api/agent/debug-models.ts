import { VercelRequest, VercelResponse } from '@vercel/node';
// import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "No API Key found" });
    }

    try {
        // const genAI = new GoogleGenerativeAI(apiKey);
        // Access the model capabilities directly if possible or infer from error
        // The SDK doesn't have a direct 'listModels' on the main class in older versions, 
        // but let's try to just return a simple health check or attempt a list via REST if SDK fails.

        // Actually, let's use REST for listing models as it's most raw and reliable for debugging
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        return res.status(200).json({
            key_present: true,
            key_prefix: apiKey.substring(0, 5) + "...",
            api_response: data
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
