import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { files, productsList, driversList } = req.body as {
            files?: Array<{ base64: string; name: string; mimeType?: string }>;
            productsList?: Array<{ sku: string; name: string }>;
            driversList?: Array<{ uid: string; name: string }>;
        };

        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'No files provided. Please upload at least 1 DO PDF.' });
        }

        if (files.length > 15) {
            return res.status(400).json({ error: 'Maksimum 15 fail PDF dibenarkan / Maximum 15 DO PDF files allowed per trip.' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server Google Gemini AI Key not configured.' });
        }

        // Fetch known product aliases from database
        let aliasList: Array<{ customer: string; alias_name: string; sku: string }> = [];
        if (supabaseUrl && supabaseKey) {
            try {
                const sbClient = createClient(supabaseUrl, supabaseKey);
                const { data } = await sbClient.from('product_aliases_v2').select('customer, alias_name, sku');
                if (data) aliasList = data;
            } catch (err) {
                console.warn("Failed to fetch product aliases:", err);
            }
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Build prompt
        let prompt = `You are a logistics document intelligence AI for Packsecure OS (PackSecure / DIY Venture Sdn. Bhd.).
Analyze the attached Delivery Order (DO) PDF document(s).
All the uploaded PDF documents belong to ONE single lorry delivery trip (一次出车派送任务).
There may be 1 to 15 DOs across the PDF(s). Each DO represents one delivery drop to a customer.

TASK:
Extract structured data for each Delivery Order (DO) and synthesize the whole Trip summary.

FOR EACH DELIVERY ORDER:
- "doNumber": The official printed DO number (usually starts with "OPM", e.g., "OPM2609-0551", "OPM2609-0556").
- "customer": Recipient customer or company name (e.g. "AURA SNR EMPIRE", "SITI SARAH", "XUN HOONG HARDWARE").
- "deliveryAddress": Complete delivery address with street, unit, industrial park, postcode, town, and state.
- "phone": Contact telephone or mobile number if present (labeled "TEL:", e.g. "011-56324303").
- "zone": Primary Malaysian state/region for delivery (e.g., KELANTAN, PERAK, PENANG, KEDAH, SELANGOR, KL, NEGERI SEMBILAN, MELAKA, JOHOR, PAHANG, TERENGGANU).
- "orderDate": DO issue date in YYYY-MM-DD format (e.g., "2026-09-14").
- "terms": Payment term if visible (e.g., "C.O.D.", "30 Days").
- "items": Array of products on this DO:
  [
    {
      "product": "Product description as printed on DO (e.g. Bubble Wrap Single Layer Clear 1m x 100m (MERAH))",
      "quantity": 15, // Positive integer
      "uom": "UNIT",
      "sku": "Matched SKU from the Reference Product List below, or empty string if no clear match"
    }
  ]
- "doTotal": Sum of item quantities on this DO.

FOR THE OVERALL TRIP:
- "suggestedTripDate": Prevailing delivery/trip date in YYYY-MM-DD format (default to today 2026-09-16 if not clear).
- "primaryZone": Main region of the trip (e.g., KELANTAN).
- "totalDrops": Total number of distinct customer delivery stops (count of DOs).
- "totalRolls": Sum of all item quantities across all DOs.
- "destinationsSummary": Comma-separated list of towns/areas visited (e.g., "Kota Bharu, Pasir Puteh, Pasir Mas").

CRITICAL RULES:
1. QUANTITY MUST BE ACCURATE: Extract the exact printed quantity in the "Qty" column.
2. CLEAN TEXT: Strip unnecessary carriage returns from customer names or product titles.
3. RAW JSON ONLY: Return strictly valid JSON object without markdown formatting, ticks, or backticks.
`;

        if (productsList && Array.isArray(productsList) && productsList.length > 0) {
            prompt += `\nReference Product List (SKU and Name):\n`;
            prompt += productsList.slice(0, 100).map(p => `- SKU: ${p.sku} | Name: ${p.name}`).join('\n');
            prompt += `\nMatch each DO item to the closest valid SKU above.\n`;
        }

        if (aliasList && aliasList.length > 0) {
            prompt += `\nKnown Customer Aliases:\n`;
            prompt += aliasList.slice(0, 50).map(a => `- ${a.customer}: "${a.alias_name}" -> SKU: ${a.sku}`).join('\n');
        }

        // Prepare file parts
        const fileParts = files.map(f => {
            let mime = f.mimeType || 'application/pdf';
            if (f.name && f.name.toLowerCase().endsWith('.pdf')) {
                mime = 'application/pdf';
            }
            return {
                inlineData: {
                    data: f.base64,
                    mimeType: mime
                }
            };
        });

        const result = await model.generateContent([prompt, ...fileParts]);
        const responseText = result.response.text();
        
        // Clean JSON text
        const cleanedJson = responseText
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        let parsed: any;
        try {
            parsed = JSON.parse(cleanedJson);
        } catch (jsonErr) {
            console.error("Failed to parse Gemini JSON response:", responseText);
            throw new Error("AI parsing response was not valid JSON. Please try again with clearer PDF files.");
        }

        return res.status(200).json({
            success: true,
            suggestedTripDate: parsed.suggestedTripDate || new Date().toISOString().split('T')[0],
            primaryZone: parsed.primaryZone || '',
            totalDrops: typeof parsed.totalDrops === 'number' ? parsed.totalDrops : (parsed.deliveryOrders?.length || 1),
            totalRolls: typeof parsed.totalRolls === 'number' ? parsed.totalRolls : 0,
            destinationsSummary: parsed.destinationsSummary || '',
            deliveryOrders: Array.isArray(parsed.deliveryOrders) ? parsed.deliveryOrders : []
        });

    } catch (err: any) {
        console.error("Error in parse-trip-pdf:", err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to process DO PDF files'
        });
    }
}
