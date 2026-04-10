import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://kdahubyhwndgyloaljak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkYWh1Ynlod25kZ3lsb2FsamFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM4Njg4OSwiZXhwIjoyMDgwOTYyODg5fQ.82VCH3EqJXXfdR08i_pxr7yafb1gNunLd6wEomRcfVM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTotalOutSinceAudit() {
    const sku = 'BW-SL-CLR-100Mx100CMx1ROLL-RED';
    const location = 'OPM Lama';
    
    // 1. Get the latest audit timestamp
    const { data: auditData } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('location_name', location)
        .eq('event_type', 'Audit Adjustment') // could also be 'Audit' if v1
        .order('timestamp', { ascending: false })
        .limit(1);

    if (!auditData || auditData.length === 0) {
        console.log("No audit found.");
        return;
    }

    const latestAudit = auditData[0];
    const auditTime = latestAudit.timestamp || latestAudit.created_at;
    const initialQty = latestAudit.change_qty !== null ? latestAudit.change_qty : latestAudit.quantity;
    
    // 2. Get all transactions AFTER the audit
    const { data: records } = await supabase.from('stock_ledger_v2')
        .select('*')
        .eq('sku', sku)
        .eq('location_name', location)
        .gt('timestamp', auditTime)
        .order('timestamp', { ascending: true });

    let totalOut = 0;
    let totalIn = 0;
    let report = `=== SINCE LAST AUDIT ===\n`;
    report += `Latest Audit: ${new Date(auditTime).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}\n`;
    report += `Audit Overwrite Qty: ${initialQty}\n\n`;
    
    if (records) {
        records.forEach(r => {
            const qty = r.change_qty !== null ? r.change_qty : r.quantity;
            if (qty < 0 || r.event_type === 'Transfer Out' || r.event_type === 'Stock Out') {
                let deduction = qty;
                if (deduction > 0) deduction = -deduction; // safeguard
                
                totalOut += deduction;
                report += `[OUT] ${new Date(r.timestamp || r.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', hour12: false })} | Type: ${r.event_type} | Ref: ${r.reference_id || r.reference_doc || r.reference || '-'} | Qty: ${deduction}\n`;
            } else if (qty > 0) {
                totalIn += qty;
            }
        });
    }

    report += `\nSUMMARY:\n`;
    report += `-----------------\n`;
    report += `Total Output (Stock In from Prod): +${totalIn}\n`;
    report += `Total Exited (DO & Manual Out): ${totalOut}\n`;
    report += `Current Theoretical Balance: ${Number(initialQty) + totalIn + totalOut}\n`;

    fs.writeFileSync('audit_report.txt', report);
}

checkTotalOutSinceAudit();
