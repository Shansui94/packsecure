import { UniversalQueryResponse } from '../types';

/**
 * 获取今日高管智能快报 (Daily Briefing)
 */
export async function fetchDailyBriefing(userRole = 'Admin', userName = 'Boss'): Promise<UniversalQueryResponse> {
    const res = await fetch(`/api/agent/universal-query?action=briefing&userRole=${encodeURIComponent(userRole)}&userName=${encodeURIComponent(userName)}`, {
        method: 'GET'
    });

    if (!res.ok) {
        throw new Error(`获取早晚报失败 (${res.status})`);
    }

    return await res.json();
}

/**
 * 老板自然语言智能透视查询
 */
export async function queryBossCoPilot(
    query: string,
    userRole = 'Admin',
    userName = 'Boss'
): Promise<UniversalQueryResponse> {
    const res = await fetch('/api/agent/universal-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'query',
            query,
            userRole,
            userName
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `查询失败 (${res.status})`);
    }

    return await res.json();
}

/**
 * 导出明细表格为 CSV 文件
 */
export function exportTableToCsv(
    tableData: { title?: string; columns: string[]; rows: (string | number)[][] },
    fileName = 'packsecure_boss_report'
) {
    if (!tableData || !tableData.columns || tableData.columns.length === 0) return;

    const escapeCsv = (val: any) => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
    };

    const header = tableData.columns.map(escapeCsv).join(',');
    const rows = tableData.rows.map((row) => row.map(escapeCsv).join(','));
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 一键复制 WhatsApp 格式高亮摘要
 */
export async function copyWhatsAppText(text: string): Promise<boolean> {
    try {
        if (navigator?.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch {
        return false;
    }
}
