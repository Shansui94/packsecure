// import * as React from 'react';
import { useState } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { reportService } from '../services/reportService';
import { FileText, CheckCircle, RefreshCw } from 'lucide-react';

const SPREADSHEET_ID = '1mUBb5RYFq-G2a8bYKnYTop1A-4KSIoawSXH6J3TBITQ'; // From User Link
// const SHEET_NAME = 'MAX TAN';
// const RANGE_NAME = "'MAX TAN'!A:F";

export const AutoDailyReport = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
    const { appendToSheet, readSheetValues, updateSheetValues } = useGoogleDrive();
    const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('last_report_sync'));
    const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');

    const generateAndSync = async () => {
        if (!isAuthenticated) return setMsg("Google Drive not connected");
        setStatus('syncing');
        setMsg("Calculating stats...");

        try {
            const stats = await reportService.getDailyStats(new Date());

            const rowData = [
                stats.date,
                stats.startTime ?? '-',
                stats.endTime ?? '-',
                stats.duration,
                stats.totalQuantity,
                stats.productBreakdown
            ];

            setMsg("Checking Sheet...");
            const currentData = await readSheetValues(SPREADSHEET_ID, "'MAX TAN'!A:A");
            const rows = currentData || [];

            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === stats.date) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex >= 0) {
                const updateRange = `'MAX TAN'!A${rowIndex + 1}:F${rowIndex + 1}`;
                await updateSheetValues(SPREADSHEET_ID, updateRange, [rowData]);
                setMsg(`Updated row ${rowIndex + 1} for ${stats.date}`);
            } else {
                await appendToSheet(SPREADSHEET_ID, "'MAX TAN'!A1", [rowData]);
                setMsg(`Appended new row for ${stats.date}`);
            }

            setLastSync(new Date().toLocaleTimeString());
            localStorage.setItem('last_report_sync', new Date().toLocaleTimeString());
            setStatus('success');

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            const errMsg = err?.result?.error?.message || err?.message || JSON.stringify(err);
            setMsg(errMsg.slice(0, 50) + (errMsg.length > 50 ? '...' : ''));
        }
    };

    // Auto-Run effect? Or Manual Button?
    // User requested "Button" AND "Automatic".
    // Let's providing a small Widget UI.

    return (
        <div className="p-4 border border-white/5 bg-white/5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <FileText size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white">Daily Production Report</h4>
                    <p className="text-xs text-gray-400">
                        {status === 'idle' ? `Last Sync: ${lastSync || 'Never'}` : msg}
                    </p>
                </div>
            </div>
            <button
                onClick={generateAndSync}
                disabled={status === 'syncing' || !isAuthenticated}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${status === 'syncing' ? 'bg-yellow-500/10 text-yellow-500' :
                    !isAuthenticated ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                        'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    }`}
            >
                {status === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> :
                    status === 'success' ? <CheckCircle size={14} /> : <RefreshCw size={14} />}
                {status === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
        </div>
    );
};
