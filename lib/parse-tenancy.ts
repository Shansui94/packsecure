import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(supabaseUrl, supabaseKey);
}

function getGeminiModel() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

export async function handleParseTenancy(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { fileBase64, fileName, mimeType } = req.body || {};

        if (!fileBase64 || !fileName) {
            return res.status(400).json({ error: 'fileBase64 and fileName are required' });
        }

        const supabase = getSupabaseAdmin();
        const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        
        let resolvedMime = mimeType;
        if (!resolvedMime) {
            const lowerName = fileName.toLowerCase();
            if (lowerName.endsWith('.pdf')) resolvedMime = 'application/pdf';
            else if (lowerName.endsWith('.png')) resolvedMime = 'image/png';
            else if (lowerName.endsWith('.webp')) resolvedMime = 'image/webp';
            else resolvedMime = 'image/jpeg';
        }

        // 1. Upload file to Supabase Storage bucket 'documents'
        const year = new Date().getFullYear();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `tenancy_agreements/${year}/${Date.now()}_${sanitizedFileName}`;
        
        let fileUrl = '';
        try {
            const fileBuffer = Buffer.from(cleanBase64, 'base64');
            const { error: uploadErr } = await supabase.storage
                .from('documents')
                .upload(storagePath, fileBuffer, { contentType: resolvedMime, upsert: true });

            if (!uploadErr) {
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(storagePath);
                fileUrl = publicUrl;
            } else {
                console.warn('Supabase storage upload warning:', uploadErr);
            }
        } catch (stErr) {
            console.warn('Storage upload error (proceeding to extraction):', stErr);
        }

        // 2. Call Gemini AI to extract Tenancy Agreement fields
        const model = getGeminiModel();
        const prompt = `You are a real estate and commercial legal AI assistant specialized in tenancy agreements (Surat Perjanjian Sewa / 租赁合同) in Malaysia.
Carefully review the attached tenancy agreement document (PDF or scanned image) and extract structured lease data.

Extract the following information accurately:
- "title": A concise descriptive title for this lease (e.g. "Taiping Main Factory Warehouse", "Worker Hostel Kamunting Unit 2B", "Nilai Branch Office").
- "category": Best guess among "Factory/Warehouse", "Worker Hostel", "Office", "Lorry Yard", or "Other".
- "property_address": Full demised premises / property address mentioned in the agreement.
- "location_tag": Town/city or factory district if identifiable (e.g. "Taiping", "Kamunting", "Nilai", "Johor Bahru", "Kota Bharu").
- "landlord_name": Full name of the Landlord / Lessor (Tuan Rumah / Pemberi Sewa).
- "landlord_phone": Landlord's contact telephone / mobile number if stated, or null.
- "landlord_ic_ssm": Landlord's NRIC (Kad Pengenalan) or SSM company number if stated, or null.
- "start_date": Lease commencement / commencement date in YYYY-MM-DD format (or null if not found).
- "end_date": Lease expiry / termination date in YYYY-MM-DD format (or null if not found).
- "monthly_rent": Monthly rental in Malaysian Ringgit (RM) as a pure positive number (no currency symbols or commas, e.g. 3500.00).
- "security_deposit": Security deposit in RM as a pure positive number, or 0.
- "utility_deposit": Water/electricity deposit in RM as a pure positive number, or 0.
- "notice_period_months": Notice period in months for renewal or early termination (usually 2 or 3, integer), or 2 if not explicitly mentioned.
- "tags": Array of 2 to 4 relevant tags (e.g. ["Warehouse", "Taiping", "Lease2026"]).
- "notes": Concise 1-2 sentence summary of key covenants (e.g. renewal option clause, payment due date, permitted use).

Return RAW JSON ONLY, with no markdown code blocks and no surrounding commentary:
{
  "title": "string",
  "category": "string",
  "property_address": "string",
  "location_tag": "string",
  "landlord_name": "string",
  "landlord_phone": "string or null",
  "landlord_ic_ssm": "string or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "monthly_rent": 0,
  "security_deposit": 0,
  "utility_deposit": 0,
  "notice_period_months": 2,
  "tags": ["tag1", "tag2"],
  "notes": "string"
}`;

        const part = {
            inlineData: {
                data: cleanBase64,
                mimeType: resolvedMime
            }
        };

        const result = await model.generateContent([prompt, part]);
        const responseText = result.response.text();

        let extracted: any = {};
        try {
            const cleanJson = responseText
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim();
            extracted = JSON.parse(cleanJson);
        } catch (jsonErr) {
            console.error('Failed to parse Gemini tenancy response as JSON:', responseText);
            extracted = {
                title: fileName.replace(/\.[^/.]+$/, ""),
                notes: responseText.slice(0, 500)
            };
        }

        return res.status(200).json({
            success: true,
            extracted,
            file_url: fileUrl,
            storage_path: storagePath,
            file_name: fileName
        });

    } catch (err: any) {
        console.error('Tenancy AI extraction error:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to process tenancy agreement with AI'
        });
    }
}
