import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text, type } = req.body; // type = 'customers' | 'items' etc
        if (!text) return res.status(400).json({ error: 'Text data required' });

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use Standard Flash for better intelligence (Billing Enabled)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = `Analyze the following unstructured text and extract specific data for type: "${type || 'general'}".
        Return a STRICT JSON ARRAY of objects.`;

        if (type === 'customers') {
            prompt += `
            Each object must have: "name", "phone", "address".
            Infer the "zone" (North/South/Central/East Malaysia) from address if possible.
            If multiple records exist, return multiple objects.`;
        } else {
            prompt += `
            Extract meaningful fields based on the text structure (e.g. Header1, Header2).
            Use keys like "col1", "col2", "col3" or specific names if obvious.`;
        }

        prompt += `
        Text to analyze:
        """${text}"""
        
        Do not include markdown formatting (like \`\`\`json). Return raw JSON only.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const resultText = response.text();

        const cleanJson = resultText.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);

        return res.status(200).json(parsedData);

    } catch (e: any) {
        console.error("Text Parse API Error:", e);
        return res.status(500).json({ error: e.message || "Text analysis failed" });
    }
}
