import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)!;
const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { query, threshold = 0.7 } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    try {
        // Step 1: Generate embedding for user input
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(query);
        const embedding = result.embedding.values;

        // Step 2: Search for similar locations via Supabase RPC
        const { data, error } = await supabase.rpc('match_location', {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: 5
        });

        if (error) {
            console.error("RPC Error:", error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({
            query,
            matches: (data || []).map((m: any) => ({
                location_name: m.location_name,
                similarity: Math.round(m.similarity * 1000) / 10 // e.g. 86.3%
            }))
        });
    } catch (e: any) {
        console.error("Match Location Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
