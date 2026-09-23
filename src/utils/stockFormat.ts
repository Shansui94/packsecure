/**
 * Stock formatting utilities for quantities and variances
 */

export const formatQty = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0';
    const num = Number(val);
    if (Number.isInteger(num)) {
        return num.toLocaleString();
    }
    const fixed = parseFloat(num.toFixed(2));
    return fixed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const formatSignedQty = (val: number | string | undefined | null): string => {
    const num = Number(val) || 0;
    if (Math.abs(num) < 0.0001) return '0';
    const sign = num > 0 ? '+' : '-';
    const absFormatted = formatQty(Math.abs(num));
    return `${sign}${absFormatted}`;
};

// Robust Audit Parser for notes
export const parseAuditActual = (auditRow: any): number => {
    if (!auditRow) return 0;
    const notes = String(auditRow.notes || '');
    
    // Match "Actual: 150" or "Actual:150" or "Actual: 60.5"
    const match = notes.match(/Actual\s*:\s*([\d.-]+)/i);
    if (match && !isNaN(parseFloat(match[1]))) {
        return parseFloat(match[1]);
    }
    
    // Match "Base = 122" or "Base=122"
    const matchBase = notes.match(/Base\s*=\s*([\d.-]+)/i);
    if (matchBase && !isNaN(parseFloat(matchBase[1]))) {
        return parseFloat(matchBase[1]);
    }

    // Fallback to balance_after or change_qty
    if (auditRow.balance_after != null && !isNaN(Number(auditRow.balance_after))) {
        return Number(auditRow.balance_after);
    }
    
    return Number(auditRow.change_qty) || 0;
};

