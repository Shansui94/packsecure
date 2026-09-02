import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

const MULTI_RECEIPT_CATEGORIES = ['PETROL_FLEET', 'TNGO_TOLL', 'LORRY_SERVICE', 'MACHINE_EXPENSES'];

// ----------------------------------------------------------------------
// 1. DASHBOARD METRICS HANDLER
// ----------------------------------------------------------------------
export async function handleDashboardMetrics(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
        try {
            const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

            // 1. Fetch categories
            const { data: categories, error: catErr } = await supabase
                .from('document_manifest_entities')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (catErr) throw catErr;

            // 2. Fetch stored metrics
            const { data: storedMetrics, error: metErr } = await supabase
                .from('william_dashboard_metrics')
                .select('*')
                .eq('year', year);

            if (metErr) throw metErr;

            // 3. Fetch all extracted documents for this year to populate vouchers
            const { data: yearDocs } = await supabase
                .from('extracted_documents')
                .select('id, file_name, file_url, category_key, period_year, period_month, total_amount, doc_date, doc_number, vendor_name, vehicle_plate, location_tag, created_at')
                .eq('period_year', year);

            // Group vouchers by category_key and month
            const vouchersMap: Record<string, Record<number, any[]>> = {};
            (yearDocs || []).forEach(doc => {
                if (!doc.category_key || !doc.period_month) return;
                if (!vouchersMap[doc.category_key]) vouchersMap[doc.category_key] = {};
                if (!vouchersMap[doc.category_key][doc.period_month]) vouchersMap[doc.category_key][doc.period_month] = [];
                vouchersMap[doc.category_key][doc.period_month].push(doc);
            });

            // 4. Aggregate live system operational data
            let currentLiveStock = 0;
            try {
                const { data: stockData } = await supabase.from('live_stock').select('quantity');
                if (stockData) {
                    currentLiveStock = stockData.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);
                }
            } catch (err) {
                console.warn('Failed to aggregate live_stock:', err);
            }

            const monthlyTrips: Record<number, number> = {};
            try {
                const { data: tripData } = await supabase
                    .from('logistics_trips')
                    .select('created_at')
                    .gte('created_at', `${year}-01-01`)
                    .lte('created_at', `${year}-12-31`);

                if (tripData) {
                    tripData.forEach(t => {
                        if (t.created_at) {
                            const m = new Date(t.created_at).getMonth() + 1;
                            monthlyTrips[m] = (monthlyTrips[m] || 0) + 1;
                        }
                    });
                }
            } catch (err) {
                console.warn('Failed to aggregate trips:', err);
            }

            const monthlyRecycle: Record<number, number> = {};
            const monthlyDefect: Record<number, number> = {};
            try {
                const { data: prodLogs } = await supabase
                    .from('production_logs_v2')
                    .select('machine_id, output_qty, reject_qty, created_at')
                    .gte('created_at', `${year}-01-01`)
                    .lte('created_at', `${year}-12-31`);

                if (prodLogs) {
                    prodLogs.forEach(p => {
                        const dateStr = p.created_at;
                        if (!dateStr) return;
                        const m = new Date(dateStr).getMonth() + 1;
                        const isRecycle = (p.machine_id && (p.machine_id.includes('T5') || p.machine_id.includes('N3') || p.machine_id.toLowerCase().includes('recycle')));
                        if (isRecycle) {
                            monthlyRecycle[m] = (monthlyRecycle[m] || 0) + (Number(p.output_qty) || 0);
                        }
                        if (p.reject_qty) {
                            monthlyDefect[m] = (monthlyDefect[m] || 0) + (Number(p.reject_qty) || 0);
                        }
                    });
                }
            } catch (err) {
                console.warn('Failed to aggregate production logs:', err);
            }

            // 5. Build matrix
            const matrix: Record<string, any> = {};

            (categories || []).forEach(cat => {
                matrix[cat.category_key] = {
                    category: cat,
                    months: {},
                    total: 0,
                    average: 0
                };

                for (let m = 1; m <= 12; m++) {
                    const docList = vouchersMap[cat.category_key]?.[m] || [];
                    const docSum = docList.reduce((acc, d) => acc + (Number(d.total_amount) || 0), 0);

                    matrix[cat.category_key].months[m] = {
                        value: docSum,
                        source_type: cat.data_source === 'SYSTEM_LIVE' ? 'SYSTEM_SYNCED' : 'AUTO_EXTRACTED',
                        vouchers: docList,
                        file_url: docList.length > 0 ? docList[docList.length - 1].file_url : undefined,
                        document_id: docList.length > 0 ? docList[docList.length - 1].id : undefined
                    };
                }
            });

            // Merge stored metrics (including manual overrides)
            (storedMetrics || []).forEach(sm => {
                if (matrix[sm.category_key] && matrix[sm.category_key].months[sm.month]) {
                    const existingVouchers = matrix[sm.category_key].months[sm.month].vouchers || [];
                    const isMulti = MULTI_RECEIPT_CATEGORIES.includes(sm.category_key);

                    // If manual override, prioritize override value; if multi-receipt and has vouchers, use voucher sum
                    let effectiveVal = Number(sm.metric_value) || 0;
                    if (sm.source_type !== 'MANUAL_OVERRIDE' && isMulti && existingVouchers.length > 0) {
                        effectiveVal = existingVouchers.reduce((acc: number, d: any) => acc + (Number(d.total_amount) || 0), 0);
                    }

                    matrix[sm.category_key].months[sm.month] = {
                        value: effectiveVal,
                        source_type: sm.source_type,
                        file_url: sm.file_url || (existingVouchers.length > 0 ? existingVouchers[existingVouchers.length - 1].file_url : undefined),
                        document_id: sm.document_id || (existingVouchers.length > 0 ? existingVouchers[existingVouchers.length - 1].id : undefined),
                        notes: sm.notes,
                        vouchers: existingVouchers
                    };
                }
            });

            // Merge Live Stock
            if (matrix['STOCK_BALANCE']) {
                const curM = new Date().getMonth() + 1;
                for (let m = 1; m <= curM; m++) {
                    if (matrix['STOCK_BALANCE'].months[m].value === 0) {
                        matrix['STOCK_BALANCE'].months[m].value = currentLiveStock;
                    }
                }
            }

            // Merge Trips
            if (matrix['TRIP_BY_STATES']) {
                for (let m = 1; m <= 12; m++) {
                    if (matrix['TRIP_BY_STATES'].months[m].value === 0 && monthlyTrips[m]) {
                        matrix['TRIP_BY_STATES'].months[m].value = monthlyTrips[m];
                    }
                }
            }

            // Merge Recycle
            if (matrix['RECYCLE_AMOUNT']) {
                for (let m = 1; m <= 12; m++) {
                    if (matrix['RECYCLE_AMOUNT'].months[m].value === 0 && monthlyRecycle[m]) {
                        matrix['RECYCLE_AMOUNT'].months[m].value = monthlyRecycle[m];
                    }
                }
            }

            // Merge Scrap/Defect
            if (matrix['SF_DEFECT_AMOUNT']) {
                for (let m = 1; m <= 12; m++) {
                    if (matrix['SF_DEFECT_AMOUNT'].months[m].value === 0 && monthlyDefect[m]) {
                        matrix['SF_DEFECT_AMOUNT'].months[m].value = monthlyDefect[m];
                    }
                }
            }

            // Calculate Totals and Averages
            Object.values(matrix).forEach((row: any) => {
                let sum = 0;
                let count = 0;
                for (let m = 1; m <= 12; m++) {
                    const val = row.months[m].value;
                    sum += val;
                    if (val > 0) count++;
                }
                row.total = sum;
                row.average = count > 0 ? Math.round(sum / count) : 0;
            });

            // Sales Summary
            const salesSummary = {
                autocount: matrix['AUTOCOUNT_SALES']?.total || 0,
                shopee: matrix['SHOPEE_SALES']?.total || 0,
                grand_total_sales: (matrix['AUTOCOUNT_SALES']?.total || 0) + (matrix['SHOPEE_SALES']?.total || 0),
                monthly_total_sales: {} as Record<number, number>
            };

            for (let m = 1; m <= 12; m++) {
                const ac = matrix['AUTOCOUNT_SALES']?.months[m]?.value || 0;
                const sh = matrix['SHOPEE_SALES']?.months[m]?.value || 0;
                salesSummary.monthly_total_sales[m] = ac + sh;
            }

            return res.status(200).json({
                year,
                categories: categories || [],
                matrix,
                salesSummary
            });

        } catch (err: any) {
            console.error('Metrics fetch error:', err);
            return res.status(500).json({ error: err.message || 'Failed to fetch metrics' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { year, month, category_key, metric_value, notes, userId } = req.body;

            if (!year || !month || !category_key) {
                return res.status(400).json({ error: 'year, month, and category_key are required' });
            }

            const { data, error } = await supabase
                .from('william_dashboard_metrics')
                .upsert({
                    year: Number(year),
                    month: Number(month),
                    category_key,
                    metric_value: Number(metric_value) || 0,
                    source_type: 'MANUAL_OVERRIDE',
                    notes: notes || 'Manual edit by user',
                    updated_by: userId || 'USER',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'year,month,category_key' })
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        } catch (err: any) {
            return res.status(500).json({ error: err.message || 'Failed to save metric' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}

// ----------------------------------------------------------------------
// 2. ENTITIES HANDLER
// ----------------------------------------------------------------------
export async function handleEntities(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('document_manifest_entities')
                .select('*')
                .order('section', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            return res.status(200).json(data);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { id, name, category_key, section, owner, folder_slug, aliases = [], data_source = 'PDF_EXTRACT', unit = 'RM', is_active = true, notes } = req.body;

            if (!name || !category_key || !section || !owner) {
                return res.status(400).json({ error: 'name, category_key, section, and owner are required' });
            }

            const cleanSlug = (folder_slug || category_key.toLowerCase()).replace(/[^a-zA-Z0-9_\-/]/g, '_');
            const payload = {
                name,
                category_key: category_key.toUpperCase(),
                section,
                owner,
                folder_slug: cleanSlug,
                aliases: Array.isArray(aliases) ? aliases : JSON.parse(aliases || '[]'),
                data_source,
                unit,
                is_active,
                notes: notes || null,
                updated_at: new Date().toISOString()
            };

            let result;
            if (id) {
                const { data, error } = await supabase.from('document_manifest_entities').update(payload).eq('id', id).select().single();
                if (error) throw error;
                result = data;
            } else {
                const { data, error } = await supabase.from('document_manifest_entities').upsert(payload, { onConflict: 'category_key' }).select().single();
                if (error) throw error;
                result = data;
            }

            return res.status(200).json({ success: true, entity: result });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}

// ----------------------------------------------------------------------
// 3. LOGS HANDLER
// ----------------------------------------------------------------------
export async function handleLogs(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();
    try {
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const { data: logs, error: logErr } = await supabase.from('document_processing_logs').select('*').order('created_at', { ascending: false }).limit(limit);
        if (logErr) throw logErr;

        const { data: docs, error: docErr } = await supabase.from('extracted_documents').select('*, items:extracted_document_items(*)').order('created_at', { ascending: false }).limit(limit);
        if (docErr) throw docErr;

        return res.status(200).json({ logs: logs || [], documents: docs || [] });
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Failed to fetch logs' });
    }
}

// ----------------------------------------------------------------------
// 4. PROCESS HANDLER (WITH MULTI-RECEIPT AUTO-SUM & EXTENDED TAGS)
// ----------------------------------------------------------------------
export async function handleProcess(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabase = getSupabaseAdmin();
    const startTime = Date.now();

    try {
        const { documentId, fileName, fileBase64, mimeType, notes, targetCategoryKey, targetCategory } = req.body;

        if (!fileName || !fileBase64) {
            return res.status(400).json({ error: 'fileName and fileBase64 are required' });
        }

        const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        let resolvedMime = mimeType;
        if (!resolvedMime) {
            const lowerName = fileName.toLowerCase();
            if (lowerName.endsWith('.pdf')) resolvedMime = 'application/pdf';
            else if (lowerName.endsWith('.png')) resolvedMime = 'image/png';
            else if (lowerName.endsWith('.webp')) resolvedMime = 'image/webp';
            else resolvedMime = 'image/jpeg';
        }

        // Fetch categories
        const { data: activeEntities } = await supabase
            .from('document_manifest_entities')
            .select('*')
            .eq('is_active', true);

        const entityListStr = (activeEntities || [])
            .map(e => `- ${e.name} (Key: ${e.category_key}, Section: ${e.section}, Owner: ${e.owner}, Aliases: ${(e.aliases || []).join(', ')})`)
            .join('\n');

        const systemPrompt = `You are an AI Document Intelligence Agent for Packsecure OS.
Analyze the provided document (invoice, bill, receipt, workshop service voucher, fuel receipt, delivery order, or statement) and extract structured operational and financial data.
Match with available categories:
${entityListStr}

CRITICAL RULES:
- "period_year": 4-digit integer (e.g. 2026).
- "period_month": 1 to 12 representing the operational/billing month.
- "total_amount": Final positive float amount (no currency symbols).
- "category_key": Must match one of the keys above, or "UNASSIGNED".
- "vendor_name": Merchant or supplier name (e.g. "Petronas", "Tenaga Nasional Berhad", "Ban Lee Hin Workshop", "Lembaga Air Perak").
- "vehicle_plate": Lorry registration plate if visible (e.g. "AKB 8821", "WVT 3122", "WUA 918", or null).
- "location_tag": Factory or location if mentioned (e.g. "Plant 1", "Plant 2", "Ipoh HQ", or null).

Respond with RAW JSON ONLY (no markdown fences):
{
  "entity_name": "string",
  "category_key": "string",
  "vendor_name": "string",
  "vehicle_plate": "string or null",
  "location_tag": "string or null",
  "doc_type": "INVOICE" | "BILL" | "RECEIPT" | "DELIVERY_ORDER" | "REPORT" | "STATEMENT",
  "doc_number": "string",
  "doc_date": "YYYY-MM-DD",
  "period_year": 2026,
  "period_month": 8,
  "currency": "MYR",
  "subtotal_amount": 0.00,
  "tax_amount": 0.00,
  "total_amount": 0.00,
  "payment_terms": "string",
  "confidence_score": 0.95,
  "notes": "string",
  "line_items": []
}`;

        const model = getGeminiModel();
        const aiResult = await model.generateContent([
            systemPrompt,
            {
                inlineData: {
                    mimeType: resolvedMime,
                    data: cleanBase64
                }
            }
        ]);

        const rawAiText = aiResult.response.text().replace(/```json|```/g, '').trim();
        let extractedData: any = {};
        try {
            extractedData = JSON.parse(rawAiText);
        } catch {
            console.error('Failed to parse AI JSON:', rawAiText);
            extractedData = {
                category_key: 'UNASSIGNED',
                period_year: new Date().getFullYear(),
                period_month: new Date().getMonth() + 1,
                total_amount: 0,
                confidence_score: 0.5
            };
        }

        const periodYear = Number(extractedData.period_year) || new Date().getFullYear();
        const periodMonth = Number(extractedData.period_month) || (new Date().getMonth() + 1);
        const totalAmount = Number(extractedData.total_amount) || 0;

        const effectiveCategoryKey = (targetCategoryKey || targetCategory || extractedData.category_key || '').toUpperCase();
        const matchedEntity = (activeEntities || []).find(e => e.category_key === effectiveCategoryKey);

        const isUnassigned = !matchedEntity || effectiveCategoryKey === 'UNASSIGNED' || (extractedData.confidence_score || 1) < 0.6;
        const destFolder = (!isUnassigned && matchedEntity) ? `${matchedEntity.folder_slug}/${periodYear}` : 'Unassigned_Review';
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const finalStoragePath = `${destFolder}/${Date.now()}_${safeFileName}`;

        // Upload to Storage
        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        const { error: uploadErr } = await supabase.storage.from('documents').upload(finalStoragePath, fileBuffer, { contentType: resolvedMime, upsert: true });

        let finalPublicUrl = '';
        if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(finalStoragePath);
            finalPublicUrl = publicUrl;
        }

        const updatePayload: any = {
            file_name: fileName,
            file_url: finalPublicUrl,
            storage_path: finalStoragePath,
            category_key: matchedEntity ? matchedEntity.category_key : null,
            entity_name: extractedData.entity_name || (matchedEntity ? matchedEntity.name : 'Unknown Entity'),
            vendor_name: extractedData.vendor_name || null,
            vehicle_plate: extractedData.vehicle_plate || null,
            location_tag: extractedData.location_tag || null,
            owner: matchedEntity ? matchedEntity.owner : null,
            doc_type: extractedData.doc_type || 'INVOICE',
            doc_number: extractedData.doc_number || null,
            doc_date: extractedData.doc_date || null,
            period_year: periodYear,
            period_month: periodMonth,
            currency: extractedData.currency || 'MYR',
            subtotal_amount: extractedData.subtotal_amount || totalAmount,
            tax_amount: extractedData.tax_amount || 0,
            total_amount: totalAmount,
            payment_terms: extractedData.payment_terms || null,
            notes: extractedData.notes || notes || null,
            confidence_score: extractedData.confidence_score || 1.0,
            status: isUnassigned ? 'Unassigned_Review' : 'Dashboard_Updated',
            raw_ai_response: extractedData,
            updated_at: new Date().toISOString()
        };

        let savedDocId = documentId;
        if (documentId) {
            await supabase.from('extracted_documents').update(updatePayload).eq('id', documentId);
        } else {
            const { data: newDoc } = await supabase.from('extracted_documents').insert(updatePayload).select().single();
            if (newDoc) savedDocId = newDoc.id;
        }

        // Multi-receipt sum calculation & dashboard metrics upsert
        if (!isUnassigned && matchedEntity && periodYear && periodMonth) {
            // Query all documents for this (year, month, category_key) to compute accumulated sum
            const { data: allCatDocs } = await supabase
                .from('extracted_documents')
                .select('total_amount')
                .eq('period_year', periodYear)
                .eq('period_month', periodMonth)
                .eq('category_key', matchedEntity.category_key);

            const accumulatedSum = (allCatDocs || []).reduce((acc, d) => acc + (Number(d.total_amount) || 0), 0) || totalAmount;
            const docCount = (allCatDocs || []).length || 1;

            await supabase.from('william_dashboard_metrics').upsert({
                year: periodYear,
                month: periodMonth,
                category_key: matchedEntity.category_key,
                metric_value: accumulatedSum,
                unit: matchedEntity.unit || 'RM',
                source_type: 'AUTO_EXTRACTED',
                document_id: savedDocId || null,
                file_url: finalPublicUrl,
                notes: docCount > 1 ? `${docCount} receipts accumulated (Latest: ${fileName})` : `Extracted from ${fileName}`,
                updated_at: new Date().toISOString()
            }, { onConflict: 'year,month,category_key' });
        }

        // Log pipeline audit
        await supabase.from('document_processing_logs').insert({
            document_id: savedDocId || null,
            file_name: fileName,
            stage: 'DASHBOARD_SYNC',
            status: isUnassigned ? 'WARNING' : 'SUCCESS',
            message: isUnassigned ? 'File routed to Unassigned_Review' : `Processed ${matchedEntity?.name} for ${periodYear}-${periodMonth} (RM ${totalAmount})`,
            execution_time_ms: Date.now() - startTime
        });

        return res.status(200).json({
            success: true,
            documentId: savedDocId,
            category_key: matchedEntity ? matchedEntity.category_key : null,
            category_name: matchedEntity ? matchedEntity.name : 'Unassigned Review',
            vendor_name: extractedData.vendor_name,
            vehicle_plate: extractedData.vehicle_plate,
            location_tag: extractedData.location_tag,
            period_year: periodYear,
            period_month: periodMonth,
            total_amount: totalAmount,
            file_url: finalPublicUrl,
            extractedData,
            execution_time_ms: Date.now() - startTime
        });

    } catch (err: any) {
        console.error('Process error:', err);
        return res.status(500).json({ error: err.message || 'Processing failed' });
    }
}

// ----------------------------------------------------------------------
// MAIN DISPATCHER
// ----------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = req.url || '';
    const queryAction = req.query.action as string;

    if (url.includes('dashboard-metrics') || queryAction === 'dashboard-metrics') {
        return handleDashboardMetrics(req, res);
    }
    if (url.includes('entities') || queryAction === 'entities') {
        return handleEntities(req, res);
    }
    if (url.includes('logs') || queryAction === 'logs') {
        return handleLogs(req, res);
    }
    if (url.includes('process') || queryAction === 'process') {
        return handleProcess(req, res);
    }

    return handleDashboardMetrics(req, res);
}
