import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProductionLog } from '../types';

export const generateSessionReport = (
    operatorEmail: string,
    machineId: string,
    logs: ProductionLog[],
    loginTime: Date,
    logoutTime: Date
): void => {
    // initialize PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- Header ---
    doc.setFillColor(41, 128, 185); // Blue header
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Daily Production Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    // --- Meta Info ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    let yPos = 50;
    doc.text(`Operator: ${operatorEmail}`, 14, yPos);
    doc.text(`Machine Station: ${machineId}`, 14, yPos + 6);
    doc.text(`Scan In: ${loginTime.toLocaleString()}`, 14, yPos + 12);
    doc.text(`Scan Out: ${logoutTime.toLocaleString()}`, 14, yPos + 18);
    doc.text(`Total Entries: ${logs.length}`, 14, yPos + 24);

    // Calculate Totals matches next block start at 34
    // Wait, I messed up the yPos increment in the replacement content vs target block logic slightly?
    // Let me check target content.
    // Original line 32: Total Entries...
    // I am adding 2 lines. So Total Entries moves down.
    // Original yPos=50.
    // +6 (Machine)
    // +12 (Total Entries) -> NOW +12 (Scan In), +18 (Scan Out), +24 (Total Entries)
    // Next block uses yPos + 24 for Total Output. I need to adjust that too or let it be.
    // Actually the next block logic (lines 34-37) uses `yPos + 24`. If I push Total Entries to +24, Total Output must be +36.
    // I should include lines 34-38 in replacement to fix the offset.

    // Calculate Totals
    const totalQty = logs.reduce((sum, log) => sum + (Number(log.Output_Qty) || 0), 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Output: ${totalQty} units`, 14, yPos + 36);
    doc.setFont("helvetica", "normal");

    // --- Table ---
    // Define columns
    const columns = [
        { header: 'Time', dataKey: 'time' },
        { header: 'Job ID', dataKey: 'job' },
        { header: 'Product / Config', dataKey: 'product' },
        { header: 'Qty', dataKey: 'qty' },
    ];

    // Format Data
    const tableData = logs.map(log => ({
        time: new Date(log.Timestamp).toLocaleTimeString(),
        job: log.Job_ID || '-',
        product: (() => {
            if (!log.Note) return 'Manual Entry';
            // Handle V2 format: "V2 Production: SKU-NAME | Lane: Left"
            if (log.Note.includes('V2 Production:')) {
                const parts = log.Note.split('V2 Production:');
                if (parts.length > 1) {
                    // Get part after "V2 Production:"
                    let skuPart = parts[1].trim();
                    // If it contains a pipe "|", split and take the first part (the SKU)
                    if (skuPart.includes('|')) {
                        skuPart = skuPart.split('|')[0].trim();
                    }
                    return skuPart;
                }
            }
            // Fallback for legacy notes
            const separator = ': ';
            const idx = log.Note.lastIndexOf(separator);
            // Only split by separator if it's NOT a V2 log (to avoid accidental partials)
            // Actually, keep safe fallback but prioritize full note if unsure
            if (idx !== -1 && !log.Note.includes('|')) return log.Note.substring(idx + separator.length);
            return log.Note;
        })(),
        qty: log.Output_Qty
    }));

    // Generate Table
    autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: tableData.map(row => Object.values(row)),
        startY: yPos + 35,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        styles: { fontSize: 9 }
    });

    // --- Footer ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages} - Confidentail Internal Document`, 14, doc.internal.pageSize.height - 10);
    }

    // Save File
    const dateStr = new Date().toISOString().split('T')[0];
    const safeMachine = machineId.replace(/[^a-z0-9]/gi, '_');
    doc.save(`WorkReport_${dateStr}_${safeMachine}.pdf`);
};
