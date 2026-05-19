import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const TRIP_PROMPT = `This image is a handwritten or printed delivery trip sheet (出货单), loading list, or order form.
Return ONE JSON object (not an array at the top level) with:
- "tripDate": string YYYY-MM-DD if a sheet/order date is visible (e.g. 19/5/26 → 2026-05-19)
- "deliveryDate": string YYYY-MM-DD if a delivery date is shown
- "driverName": string if a driver name is written on the sheet
- "notes": string for sheet-level remarks only
- "trips": array of trip sections. Split by headings like "Trip Selangor", "Trip 1", "Trip 2", etc. Each trip object has:
  - "label": string, the trip heading as written
  - "destinations": string, comma-separated stops (customer codes, areas, addresses e.g. "6747 Old Bee Park, 0857 Profund")
  - "tripCategory": string zone if inferable (e.g. SELANGOR, CENTRAL, NORTH, SOUTH, JOHOR)
  - "tripDropCount": number, count of delivery stops in this trip
  - "notes": string, trip-specific remarks (times, inv sent, etc.)
  - "items": array of { "sku": string, "product": string, "quantity": number, "remark": string, "sourceLocation": string }
    For items: "product" = product name as written (keep abbreviations: cbw, dl buff, mush, DL). "quantity" is a number only. Put units like "ctn", prices, times in "remark". "sku" only if a clear product code exists, else "".

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
        const { imageBase64, type, mimeType: reqMime } = req.body as {
            imageBase64?: string;
            type?: string;
            mimeType?: string;
        };

        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data required' });
        }

        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Server AI Key not configured' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const mimeType = reqMime && reqMime.startsWith('image/') ? reqMime : 'image/jpeg';

        let prompt: string;
        if (type === 'trip') {
            prompt = TRIP_PROMPT;
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
