import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const TRIP_PROMPT = `This image is a handwritten or printed delivery trip sheet (出货单), loading list, or order form.
The sheet may contain multiple trip sections, often divided by horizontal lines or lists, each assigned to a different driver (e.g. "Sam Trip", "Tahir 1", "Tahir 2", "Mahadi 1", "Mahadi 2", "Ayan").

IMPORTANT IMAGE ORIENTATION NOTE:
- The image may be rotated (e.g., rotated 90 degrees left or right). Adjust your reading frame to correctly read the text horizontally or vertically as needed.

Return ONE JSON object (not an array at the top level) with:
- "tripDate": string YYYY-MM-DD. If only month/day is written (e.g. "22/5" or "May 22"), assume the current year 2026 (so "2026-05-22").
- "deliveryDate": string YYYY-MM-DD if a delivery date is shown.
- "driverName": string, sheet-level driver if applicable.
- "notes": string, sheet-level remarks.
- "trips": array of trip sections. Each trip object has:
  - "label": string, the trip heading or driver name section header as written (e.g., "Sam Trip", "Tahir 1").
  - "driverName": string, the driver name extracted from the section header (e.g., "Sam", "Tahir", "Mahadi", "Ayan") or written nearby.
  - "destinations": string, customer name(s), stop(s), or destination areas written for this trip (e.g. "Syamel", "Taiping", "KL"). Often written at the end of the item list or next to a slash (e.g., "/ Syamel").
  - "tripCategory": string zone if inferable (e.g. SELANGOR, CENTRAL, NORTH, SOUTH, JOHOR).
  - "tripDropCount": number, count of delivery stops in this trip (default to 1 if not specified).
  - "notes": string, trip-specific remarks.
  - "items": array of item objects:
    { "sku": string, "product": string, "quantity": number, "remark": string, "sourceLocation": string }

CRITICAL PARSING RULES FOR ITEMS:
1. QUANTITY EQUATIONS: If the quantity is written as an equation (e.g., "10+5+2+20 = 37" or "10+5+2+20"), calculate or use the final result (e.g., 37) as the "quantity". Do not keep the equation in the quantity field.
2. CHECKMARK DELIMITERS: A slash "/" or checkmark after a quantity is a delimiter/tick mark, NOT the digit "1". For example, "3/" means quantity 3, not 31; "1/" means quantity 1, not 11. Pay close attention to avoid appending "1" to quantities.
3. QUANTITIES IN PRODUCT NAMES: If the line is written like "Hitam Half x 82 (B)" or "DL Full x 81 (Real)", extract the product name (e.g., "Hitam Half") and set "quantity" to the parsed number (e.g., 82 or 81). Do not include the quantity, the "x", or "+81" in the "product" name.
4. SEMANTIC CORRECTNESS: Hand-written notes might have spelling errors (e.g., "Hitan Hald", "Mevah", "Lleur Tupe"). Clean them up and match them to the closest valid item name or SKU when a reference is provided.

If the sheet has only ONE trip block, still return "trips" with exactly one element.
Do not include markdown. Return raw JSON only.`;

/** Normalize legacy single-trip JSON into multi-trip shape */
export function normalizeTripVisionResponse(parsed: Record<string, unknown>) {
    if (Array.isArray(parsed.trips) && parsed.trips.length > 0) {
        return parsed;
    }
    const legacyTrip = {
        label: 'Trip 1',
        destinations: parsed.destinations ?? '',
        tripCategory: parsed.tripCategory ?? '',
        tripDropCount: parsed.tripDropCount ?? 1,
        notes: parsed.notes ?? '',
        items: parsed.items ?? [],
    };
    return {
        tripDate: parsed.tripDate,
        deliveryDate: parsed.deliveryDate,
        driverName: parsed.driverName,
        notes: parsed.notes,
        trips: [legacyTrip],
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageBase64, type, mimeType: reqMime, productsList, driversList } = req.body as {
            imageBase64?: string;
            type?: string;
            mimeType?: string;
            productsList?: Array<{ sku: string; name: string }>;
            driversList?: Array<{ uid: string; name: string }>;
        };

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        // Fetch product aliases from database
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        let aliasList: any[] = [];
        if (supabaseUrl && supabaseKey) {
            try {
                const sbClient = createClient(supabaseUrl, supabaseKey);
                const { data } = await sbClient.from('product_aliases_v2').select('customer, alias_name, sku');
                if (data) aliasList = data;
            } catch (err) {
                console.error("Failed to fetch product aliases:", err);
            }
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const mimeType = reqMime && reqMime.startsWith('image/') ? reqMime : 'image/jpeg';

        let prompt: string;
        if (type === 'trip') {
            prompt = TRIP_PROMPT;
            if (productsList && Array.isArray(productsList) && productsList.length > 0) {
                prompt += `\n\nReference Product List (SKU and Name):\n`;
                prompt += productsList.map(p => `- SKU: ${p.sku} | Name: ${p.name}`).join('\n');
                prompt += `\n\nPlease match the handwritten items to the closest product from the list above. If a match is found, use the exact "sku" and "product" name from the list.`;
            }
            if (driversList && Array.isArray(driversList) && driversList.length > 0) {
                prompt += `\n\nReference Driver List:\n`;
                prompt += driversList.map(d => `- Name: ${d.name}`).join('\n');
                prompt += `\n\nPlease match the driver name for each trip/section to the closest driver name in the list above.`;
            }
        } else if (type === 'odometer') {
            prompt = `This image is a photo of a vehicle's dashboard/instrument cluster focusing on the odometer (digital or mechanical mileage display).
Please analyze the image, locate the odometer display (often labeled "ODO" or showing a number followed by "km" or similar digital numbers), and extract the current mileage as a clean integer.

Return a STRICT JSON object:
{
  "mileage": number | null, // The odometer reading as a clean integer (e.g. 95671). If not visible or cannot be determined, return null.
  "confidence": "high" | "medium" | "low", // The confidence level of your reading.
  "reason": "string describing your reasoning or any visual clarity issues"
}

Do not include markdown formatting. Return raw JSON only.`;
        } else if (type === 'whatsapp_order') {
            prompt = `This image is a screenshot of a WhatsApp chat containing order details (e.g. customer name, address/destination, items to be delivered, quantities, and other instructions).
Please analyze the image, extract the order details, and return a single JSON object.

IMPORTANT IMAGE ORIENTATION NOTE:
- The image might be rotated. Adjust your reading frame if needed to read the text correctly.

Return a STRICT JSON object with:
- "customer": string, the customer name. Try to extract the company or person name placing the order.
- "deliveryAddress": string, the delivery address or destination location (e.g. "Kuala Lumpur", "Taiping", "Nilai", "No 5 Jalan Industri...").
- "zone": string, the region or zone if inferable (e.g. SELANGOR, CENTRAL, NORTH, SOUTH, JOHOR, PENANG, PERAK).
- "notes": string, any specific remarks, delivery instructions, or chat text that is relevant.
- "items": array of item objects:
  { "sku": string, "product": string, "quantity": number, "remark": string, "sourceLocation": string }

CRITICAL PARSING RULES FOR ITEMS:
1. Extract all items/products listed in the message.
2. For "product", extract the name of the product.
3. For "quantity", extract the number of rolls, boxes, or units. Convert equations to their final calculated sum if written like "10+5".
4. For "remark", extract any specific note for that item (e.g. "urgent", "colored core", etc.).
5. If a product list is provided, match the items to the closest product in the list.

Do not include markdown formatting. Return raw JSON only.`;

            if (productsList && Array.isArray(productsList) && productsList.length > 0) {
                prompt += `\n\nReference Product List (SKU and Name):\n`;
                prompt += productsList.map(p => `- SKU: ${p.sku} | Name: ${p.name}`).join('\n');
                prompt += `\n\nPlease match the items in the chat to the closest product from the list above. If a match is found, use the exact "sku" and "product" name from the list.`;
            }

            if (aliasList && aliasList.length > 0) {
                prompt += `\n\nKnown Product Aliases (Custom Name mappings used by specific customers):\n`;
                prompt += aliasList.map(a => `- Customer: ${a.customer || 'GLOBAL'} | Custom Name: ${a.alias_name} | Maps to SKU: ${a.sku}`).join('\n');
                prompt += `\n\nIf the chat screenshot uses a custom name (e.g. "黑膜") that matches a known alias, map it directly to the corresponding standard SKU.`;
            }
        } else {
            prompt = `Extract customer data from this image (e.g. invoice, delivery order, contact card).
        Return a STRICT JSON ARRAY of objects. 
        Each object must have these keys if found: "name", "phone", "address".
        If there are multiple people/companies, return multiple objects.
        Infer the Zone (North/South/Central/East Malaysia) based on address if possible, key "zone".
        Do not include markdown formatting (like \`\`\`json). Return raw JSON only.`;
        }

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType, data: imageBase64 } },
        ]);

        const response = await result.response;
        const text = response.text();

        if (!text) {
            return res.status(500).json({ error: 'No data returned from AI' });
        }

        const cleanJson = text.replace(/```json|```/g, '').trim();
        let parsedData: unknown;
        try {
            parsedData = JSON.parse(cleanJson);
        } catch {
            console.error('Vision JSON parse failed. Raw start:', cleanJson.slice(0, 200));
            return res.status(500).json({ error: 'AI returned invalid JSON' });
        }

        if (type === 'trip' && parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
            return res.status(200).json(normalizeTripVisionResponse(parsedData as Record<string, unknown>));
        }

        return res.status(200).json(parsedData);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Vision analysis failed';
        console.error('Vision API Error:', e);
        return res.status(500).json({ error: message });
    }
}
