import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(supabaseUrl, supabaseKey);
}

function calculateDaysRemaining(endDateStr?: string | null): number | undefined {
    if (!endDateStr) return undefined;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return undefined;
    const now = new Date();
    // Normalize to start of day
    end.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function computeStatus(status: string, daysRemaining?: number): string {
    if (status === 'Terminated' || status === 'Renewed') return status;
    if (daysRemaining === undefined) return status || 'Active';
    if (daysRemaining < 0) return 'Expired';
    if (daysRemaining <= 60) return 'Expiring_Soon';
    return 'Active';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabase = getSupabaseAdmin();

    // ── 1. GET: Fetch Tenancy Agreements ─────────────────────────────
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('tenancy_agreements')
                .select('*')
                .order('end_date', { ascending: true });

            if (error) {
                // If table doesn't exist yet in Supabase, return empty list gracefully
                if (
                    error.code === '42P01' || 
                    error.code === 'PGRST205' || 
                    String(error.message || '').includes('Could not find the table') ||
                    String(error.message || '').includes('schema cache')
                ) {
                    console.warn('[Tenancy API] tenancy_agreements table not yet created in Supabase.');
                    return res.status(200).json({ 
                        agreements: [], 
                        tableReady: false,
                        notice: 'Please execute scripts/create_tenancy_agreements_table.sql in Supabase SQL Editor' 
                    });
                }
                throw error;
            }

            const formatted = (data || []).map((row: any) => {
                const daysRemaining = calculateDaysRemaining(row.end_date);
                const status = computeStatus(row.status, daysRemaining);
                return {
                    ...row,
                    days_remaining: daysRemaining,
                    status
                };
            });

            return res.status(200).json({ agreements: formatted, tableReady: true });
        } catch (err: any) {
            console.error('Fetch tenancy agreements error:', err);
            return res.status(500).json({ error: err.message || 'Failed to fetch agreements' });
        }
    }

    // ── 2. POST: Create, Update or Remind ────────────────────────────
    if (req.method === 'POST') {
        try {
            const { action } = req.body;

            // Sub-action: WhatsApp Reminder
            if (action === 'remind') {
                const { agreementId, targetPhone, customNote } = req.body;
                if (!agreementId) return res.status(400).json({ error: 'agreementId is required' });

                const { data: agreement, error: findErr } = await supabase
                    .from('tenancy_agreements')
                    .select('*')
                    .eq('id', agreementId)
                    .single();

                if (findErr || !agreement) {
                    return res.status(404).json({ error: 'Agreement not found' });
                }

                const daysRemaining = calculateDaysRemaining(agreement.end_date);
                const expiryText = daysRemaining !== undefined 
                    ? (daysRemaining < 0 ? `🚨 已逾期 ${Math.abs(daysRemaining)} 天` : `⚠️ 剩余 ${daysRemaining} 天到期`)
                    : '未指定';

                const reminderMsg = `🏢 *Packsecure OS — 租约续约提醒 (Tenancy Expiry Alert)*\n\n` +
                    `📌 *租赁标的*: ${agreement.title}\n` +
                    `📍 *标的地址*: ${agreement.property_address || '未填写'}\n` +
                    `👤 *房东/出租方*: ${agreement.landlord_name || '未填写'} (${agreement.landlord_phone || '无电话'})\n` +
                    `📅 *合同到期日*: ${agreement.end_date || '未指定'} (${expiryText})\n` +
                    `💵 *月租金额*: RM ${Number(agreement.monthly_rent || 0).toLocaleString()}\n` +
                    `⏳ *续约通知期*: 需提前 ${agreement.notice_period_months || 2} 个月书面通知\n` +
                    (customNote ? `💬 *备注附言*: ${customNote}\n` : '') +
                    `\n请 HR 与管理层及时跟进续约或交割事宜。`;

                // If WhatsApp credentials configured, send via WhatsApp
                const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                const token = process.env.WHATSAPP_ACCESS_TOKEN;
                const recipient = targetPhone || agreement.landlord_phone;

                let waSent = false;
                if (phoneId && token && recipient) {
                    try {
                        const cleanPhone = recipient.replace(/[^0-9]/g, '');
                        const formattedPhone = cleanPhone.startsWith('0') ? `60${cleanPhone.slice(1)}` : cleanPhone;
                        
                        const waRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                to: formattedPhone,
                                type: 'text',
                                text: { body: reminderMsg }
                            })
                        });
                        waSent = waRes.ok;
                    } catch (waErr) {
                        console.warn('WhatsApp direct send warning:', waErr);
                    }
                }

                // Update reminded timestamp
                await supabase
                    .from('tenancy_agreements')
                    .update({ 
                        whatsapp_reminded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', agreementId);

                return res.status(200).json({
                    success: true,
                    waSent,
                    reminderMsg,
                    remindedAt: new Date().toISOString()
                });
            }

            // Normal Save / Update
            const {
                id,
                title,
                category,
                property_address,
                location_tag,
                landlord_name,
                landlord_phone,
                landlord_ic_ssm,
                start_date,
                end_date,
                monthly_rent,
                security_deposit,
                utility_deposit,
                notice_period_months,
                status,
                file_url,
                storage_path,
                file_name,
                tags,
                notes,
                created_by
            } = req.body;

            if (!title) {
                return res.status(400).json({ error: 'title is required' });
            }

            const payload: any = {
                title,
                category: category || 'General',
                property_address: property_address || null,
                location_tag: location_tag || null,
                landlord_name: landlord_name || null,
                landlord_phone: landlord_phone || null,
                landlord_ic_ssm: landlord_ic_ssm || null,
                start_date: start_date || null,
                end_date: end_date || null,
                monthly_rent: Number(monthly_rent) || 0,
                security_deposit: Number(security_deposit) || 0,
                utility_deposit: Number(utility_deposit) || 0,
                notice_period_months: Number(notice_period_months) || 2,
                status: status || 'Active',
                file_url: file_url || null,
                storage_path: storage_path || null,
                file_name: file_name || null,
                tags: Array.isArray(tags) ? tags : [],
                notes: notes || null,
                created_by: created_by || null,
                updated_at: new Date().toISOString()
            };

            let savedData;
            if (id) {
                const { data, error } = await supabase
                    .from('tenancy_agreements')
                    .update(payload)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                savedData = data;
            } else {
                const { data, error } = await supabase
                    .from('tenancy_agreements')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                savedData = data;
            }

            const daysRemaining = calculateDaysRemaining(savedData.end_date);
            const computed = computeStatus(savedData.status, daysRemaining);

            return res.status(200).json({
                success: true,
                agreement: {
                    ...savedData,
                    days_remaining: daysRemaining,
                    status: computed
                }
            });

        } catch (err: any) {
            console.error('Save tenancy agreement error:', err);
            return res.status(500).json({ error: err.message || 'Failed to save agreement' });
        }
    }

    // ── 3. DELETE: Remove Agreement ─────────────────────────────────
    if (req.method === 'DELETE') {
        try {
            const { id } = req.body || req.query;
            if (!id) return res.status(400).json({ error: 'id is required' });

            const { error } = await supabase
                .from('tenancy_agreements')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.status(200).json({ success: true, deletedId: id });
        } catch (err: any) {
            console.error('Delete tenancy agreement error:', err);
            return res.status(500).json({ error: err.message || 'Failed to delete agreement' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
