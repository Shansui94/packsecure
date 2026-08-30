import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Search, RefreshCw, Box, Filter, X, TrendingUp, TrendingDown, Clipboard, ArrowUpDown, Truck, MapPin, Hash, ChevronLeft, ChevronRight, LayoutGrid, List, Scale } from 'lucide-react';
import { WAREHOUSES } from '../data/factoryData';
import { StockReconciliationDashboard } from '../components/StockReconciliationDashboard';

// --- TYPES ---
interface StockRow {
    sku: string;
    name: string;
    type: string;
    uom: string;
    loc_id?: string;
    current_stock: number; // Physical Stock
    reserved_stock?: number; // Pending orders
    available_stock?: number; // Physical - Reserved
    last_updated: string;
}

interface LedgerRow {
    txn_id: string;
    sku: string;
    change_qty: number;
    event_type: string;
    loc_id: string;
    ref_doc: string;
    notes: string;
    timestamp: string;
    timestamp_end?: string;
    created_by_name?: string;
    do_driver_name?: string;
    production_operator?: string;
}

const TYPE_STYLE: Record<string, { bgCard: string, badge: string }> = {
    FG: {
        bgCard: 'bg-gradient-to-br from-cyan-50/50 to-white border-cyan-100 hover:border-cyan-300 dark:from-cyan-500/10 dark:to-transparent dark:border-cyan-500/20 active:scale-[0.99] transition-all',
        badge: 'bg-cyan-100/50 text-cyan-700 border-cyan-200 dark:bg-black/30 dark:border-cyan-500/20 dark:text-cyan-400'
    },
    Raw: {
        bgCard: 'bg-gradient-to-br from-amber-50/50 to-white border-amber-100 hover:border-amber-300 dark:from-amber-500/10 dark:to-transparent dark:border-amber-500/20 active:scale-[0.99] transition-all',
        badge: 'bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-black/30 dark:border-amber-500/20 dark:text-amber-400'
    },
    WiP: {
        bgCard: 'bg-gradient-to-br from-violet-50/50 to-white border-violet-100 hover:border-violet-300 dark:from-violet-500/10 dark:to-transparent dark:border-violet-500/20 active:scale-[0.99] transition-all',
        badge: 'bg-violet-100/50 text-violet-700 border-violet-200 dark:bg-black/30 dark:border-violet-500/20 dark:text-violet-400'
    },
    Packaging: {
        bgCard: 'bg-gradient-to-br from-pink-50/50 to-white border-pink-100 hover:border-pink-300 dark:from-pink-500/10 dark:to-transparent dark:border-pink-500/20 active:scale-[0.99] transition-all',
        badge: 'bg-pink-100/50 text-pink-700 border-pink-200 dark:bg-black/30 dark:border-pink-500/20 dark:text-pink-400'
    },
};

const DEFAULT_STYLE = {
    bgCard: 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:from-white/5 dark:to-transparent dark:border-white/10 active:scale-[0.99] transition-all',
    badge: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-black/30 dark:border-white/10 dark:text-gray-400'
};

const TYPE_LABEL: Record<string, string> = {
    FG: 'FG', Raw: 'Raw Material', WiP: 'Work in Progress', Packaging: 'Packaging',
};

const EVENT_STYLE: Record<string, { icon: React.FC<any>; color: string; bg: string }> = {
    'Production': { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/10' },
    'Stock In': { icon: TrendingUp, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/10' },
    'Stock Out': { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
    'Audit Adjustment': { icon: Clipboard, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
    'Transfer': { icon: ArrowUpDown, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
};

const getEventStyle = (type: string, qty: number) => {
    if (EVENT_STYLE[type]) return EVENT_STYLE[type];
    return qty >= 0
        ? { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/10' }
        : { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' };
};

const LOW_STOCK_THRESHOLD = 50;

// --- DETAIL PANEL ---
const DetailPanel: React.FC<{ item: StockRow; locFilter: string; onClose: () => void }> = ({ item, locFilter, onClose }) => {
    const [ledger, setLedger] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<'Day' | 'All'>('Day');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [mobileTab, setMobileTab] = useState<'in' | 'out'>('in');

    const [selectedTxn, setSelectedTxn] = useState<LedgerRow | null>(null);
    const [doDetails, setDoDetails] = useState<any | null>(null);
    const [loadingDO, setLoadingDO] = useState(false);

    const handleTxnClick = async (row: LedgerRow) => {
        setSelectedTxn(row);
        if ((row.event_type === 'Transfer Out' || row.event_type === 'Delivered') && row.ref_doc && row.ref_doc.startsWith('DO-')) {
            setLoadingDO(true);
            const { data } = await supabase.from('sales_orders').select('*').eq('order_number', row.ref_doc).maybeSingle();
            setDoDetails(data);
            setLoadingDO(false);
        } else {
            setDoDetails(null);
        }
    };

    useEffect(() => {
        setLoading(true);
        let q = supabase
            .from('stock_ledger_v2')
            .select('txn_id, sku, change_qty, event_type, loc_id, ref_doc, notes, timestamp, created_by_name')
            .eq('sku', item.sku)
            .order('timestamp', { ascending: false })
            .limit(3000);

        if (locFilter !== 'All') q = q.eq('loc_id', locFilter);

        if (timeFilter === 'Day') {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            q = q.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
        }

        q.then(async ({ data }) => {
            const rows = data || [];
            
            if (rows.length > 0) {
                const doRefs = [...new Set(rows.map(r => r.ref_doc).filter(ref => ref?.startsWith('DO-')))];
                if (doRefs.length > 0) {
                    const { data: doData } = await supabase
                        .from('sales_orders')
                        .select('order_number, driver_id')
                        .in('order_number', doRefs);
                        
                    if (doData && doData.length > 0) {
                        const driverIds = [...new Set(doData.map(d => d.driver_id).filter(Boolean))];
                        if (driverIds.length > 0) {
                            const { data: driverData } = await supabase
                                .from('users_public')
                                .select('id, name')
                                .in('id', driverIds);
                                
                            const driverMap = new Map();
                            driverData?.forEach(d => driverMap.set(d.id, d.name));
                            
                            const doDriverMap = new Map();
                            doData.forEach(d => doDriverMap.set(d.order_number, driverMap.get(d.driver_id)));
                            
                            rows.forEach(r => {
                                if (r.ref_doc && doDriverMap.has(r.ref_doc)) {
                                    (r as any).do_driver_name = doDriverMap.get(r.ref_doc);
                                }
                            });
                        }
                    }
                }
            }

            // Enrich production rows with operator names
            const productionRows = rows.filter(r => r.event_type === 'Production' && r.notes?.includes('API-Log:'));
            if (productionRows.length > 0) {
                const machineIds = [...new Set(productionRows.map(r => {
                    const m = r.notes?.match(/API-Log:\s*(.+)/);
                    return m ? m[1].trim() : null;
                }).filter(Boolean))] as string[];

                const timestamps = productionRows.map(r => new Date(r.timestamp));
                const minDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
                const maxDate = new Date(Math.max(...timestamps.map(t => t.getTime())));
                minDate.setHours(0, 0, 0, 0);
                maxDate.setHours(23, 59, 59, 999);

                const { data: attendanceData } = await supabase
                    .from('operator_attendance')
                    .select('operator_id, machine_id, clock_in, clock_out, date')
                    .in('machine_id', machineIds)
                    .gte('date', minDate.toISOString().slice(0, 10))
                    .lte('date', maxDate.toISOString().slice(0, 10));

                if (attendanceData && attendanceData.length > 0) {
                    const opIds = [...new Set(attendanceData.map(a => a.operator_id))];
                    const { data: opNames } = await supabase
                        .from('sys_users_v2')
                        .select('employee_id, name')
                        .in('employee_id', opIds);

                    const nameMap = new Map<string, string>();
                    opNames?.forEach(o => nameMap.set(o.employee_id, o.name));

                    productionRows.forEach(r => {
                        const machineMatch = r.notes?.match(/API-Log:\s*(.+)/);
                        const machineId = machineMatch ? machineMatch[1].trim() : null;
                        if (!machineId) return;

                        const rTime = new Date(r.timestamp).getTime();
                        const TOLERANCE = 5 * 60 * 1000; // 5 min buffer for clock-in edge cases
                        const att = attendanceData.find(a => {
                            if (a.machine_id !== machineId) return false;
                            const clockIn = new Date(a.clock_in).getTime() - TOLERANCE;
                            const clockOut = a.clock_out ? new Date(a.clock_out).getTime() : Date.now();
                            return rTime >= clockIn && rTime <= clockOut;
                        });
                        if (att) {
                            (r as any).production_operator = nameMap.get(att.operator_id) || att.operator_id;
                        }
                    });
                }
            }
            
            setLedger(rows);
            setLoading(false);
        });
    }, [item.sku, locFilter, timeFilter, selectedDate]);

    const groupedData = groupLedgerAndSplit(ledger);
    const ledgerIn = groupedData.in;
    const ledgerOut = groupedData.out;

    const totalIn = ledgerIn.reduce((s, r) => s + r.change_qty, 0);
    const totalOut = ledgerOut.reduce((s, r) => s + Math.abs(r.change_qty), 0);

    function groupLedgerAndSplit(records: LedgerRow[]) {
        const grouped: LedgerRow[] = [];
        records.forEach(r => {
            const dateStr = new Date(r.timestamp).toLocaleDateString('en-MY');
            const isProduction = r.event_type === 'Production' || r.event_type === 'Stock In';
            const refStr = isProduction ? '' : (r.ref_doc || '');
            
            const existing = grouped.find(g => 
                new Date(g.timestamp).toLocaleDateString('en-MY') === dateStr &&
                (isProduction ? true : (g.ref_doc || '') === refStr) &&
                (g.created_by_name || '') === (r.created_by_name || '') &&
                (g.do_driver_name || '') === (r.do_driver_name || '') &&
                (g.production_operator || '') === (r.production_operator || '')
            );
            
            if (existing) {
                existing.change_qty = Number(existing.change_qty) + Number(r.change_qty);
                if (!existing.notes?.includes('(Aggregated Daily Total)')) {
                    existing.notes = `(Aggregated Daily Total) ` + (existing.notes || '');
                }
                
                // Track time range for aggregated production records
                const rTime = new Date(r.timestamp).getTime();
                const existingStart = new Date(existing.timestamp).getTime();
                const existingEnd = existing.timestamp_end ? new Date(existing.timestamp_end).getTime() : existingStart;
                const earliest = Math.min(existingStart, rTime);
                const latest = Math.max(existingEnd, rTime);
                existing.timestamp = new Date(earliest).toISOString();
                existing.timestamp_end = new Date(latest).toISOString();
                
                // Keep event_type sensible based on net direction
                if (existing.change_qty < 0 && !existing.event_type.includes('Out')) {
                    existing.event_type = 'Transfer Out';
                } else if (existing.change_qty > 0 && !existing.event_type.includes('In')) {
                    existing.event_type = 'Transfer In';
                }
            } else {
                grouped.push({ ...r, change_qty: Number(r.change_qty) });
            }
        });
        
        return {
            in: grouped.filter(r => r.change_qty > 0),
            out: grouped.filter(r => r.change_qty < 0)
        };
    }

    // Already aggregated and declared above for totalIn/totalOut calculations

    const renderRow = (row: LedgerRow) => {
        const style = getEventStyle(row.event_type, row.change_qty);
        const Icon = style.icon;
        const isPos = row.change_qty > 0;
        return (
            <button key={row.txn_id} onClick={() => handleTxnClick(row)} className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors border-b border-slate-200/50 dark:border-white/5 cursor-pointer group">
                <div className={`mt-0.5 w-8 h-8 rounded-xl ${style.bg} flex items-center justify-center shrink-0 border border-transparent dark:border-white/5 group-hover:scale-110 transition-transform`}>
                    <Icon size={14} className={style.color} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-xs font-black tracking-wide ${style.color}`}>{row.event_type}</span>
                        <span className={`text-base font-black tabular-nums shrink-0 ${isPos ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPos ? '+' : ''}{row.change_qty}
                        </span>
                    </div>
                    {(row.ref_doc || row.notes) && (
                        <div className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 truncate font-mono bg-slate-100 dark:bg-black/20 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 inline-block max-w-full">
                            {row.ref_doc || row.notes}
                        </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="text-[10px] text-slate-400 dark:text-gray-600 font-mono flex items-center gap-2 flex-wrap">
                            <span>
                                {new Date(row.timestamp).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                {row.timestamp_end && row.timestamp_end !== row.timestamp && (
                                    <> → {new Date(row.timestamp_end).toLocaleString('en-MY', { hour: '2-digit', minute: '2-digit' })}</>
                                )}
                            </span>
                            
                            {row.do_driver_name ? (
                                <span className="text-violet-600 dark:text-violet-400 font-bold tracking-widest uppercase bg-violet-100 dark:bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-500/20">
                                    🚚 {row.do_driver_name}
                                </span>
                            ) : row.created_by_name ? (
                                <span className="text-blue-600 dark:text-blue-400/80 font-bold tracking-widest uppercase bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/20">
                                    👤 {row.created_by_name}
                                </span>
                            ) : null}
                            {row.notes?.includes('API-Log:') && (() => {
                                const match = row.notes.match(/API-Log:\s*(.+)/);
                                return match ? (
                                    <span className="text-cyan-600 dark:text-cyan-400 font-bold tracking-widest uppercase bg-cyan-100 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20">
                                        ⚙️ {match[1].trim()}
                                    </span>
                                ) : null;
                            })()}
                            {row.production_operator && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold tracking-widest uppercase bg-amber-100 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/20">
                                    👷 {row.production_operator}
                                </span>
                            )}
                        </div>
                        {row.loc_id && locFilter === 'All' && (
                            <div className="text-[10px] text-violet-500 dark:text-violet-400/80 uppercase font-black">
                                {row.loc_id}
                            </div>
                        )}
                    </div>
                </div>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-white dark:bg-[#08080c] border-l border-slate-200 dark:border-white/10 flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-start justify-between shrink-0 bg-slate-50 dark:bg-gradient-to-r dark:from-blue-500/5 dark:to-transparent">
                    <div className="flex-1 min-w-0 pr-3">
                        <div className="text-slate-900 dark:text-white font-black text-2xl leading-tight truncate tracking-tight">{item.name}</div>
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-mono mt-1 font-bold">{item.sku}</div>
                        <div className="flex items-center gap-3 mt-3 overflow-x-auto pb-1 custom-scrollbar">
                            {locFilter !== 'All' && (
                                <div className="text-xs text-violet-700 dark:text-violet-400 font-black uppercase tracking-widest px-2 py-1 bg-violet-100 dark:bg-violet-500/10 shrink-0 inline-block rounded border border-violet-200 dark:border-violet-500/20">📍 {locFilter}</div>
                            )}
                            <div className="flex items-center border border-slate-200 bg-white dark:bg-black/40 rounded-lg p-1 dark:border-white/5 shrink-0 shadow-sm">
                                {timeFilter === 'Day' && (
                                    <div className="flex items-center mr-2 bg-slate-50 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10">
                                        <button onClick={() => {
                                            const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d);
                                        }} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-l text-slate-500 dark:text-gray-400 dark:hover:text-white transition-colors">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-[11px] font-bold px-2 text-cyan-700 dark:text-cyan-400 w-24 text-center font-mono">
                                            {selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                        <button onClick={() => {
                                            const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d);
                                        }} className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-r text-slate-500 dark:text-gray-400 dark:hover:text-white transition-colors">
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}
                                <button onClick={() => setTimeFilter('Day')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'Day' ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}>Daily</button>
                                <button onClick={() => setTimeFilter('All')} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === 'All' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}>All Time</button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 dark:hover:text-white transition-all shrink-0 border border-slate-200 dark:border-white/5 shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 dark:border-white/5 shrink-0 bg-slate-50 dark:bg-[#0a0a0f]">
                    <div className="px-4 py-4 border-r border-slate-200 dark:border-white/5 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Available <span className="hidden sm:inline">Stock</span></div>
                        <div className={`text-3xl font-black notranslate ${(item.available_stock || 0) < 0 ? 'text-red-500 dark:text-red-400' : (item.available_stock || 0) < LOW_STOCK_THRESHOLD ? 'text-amber-500 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`} translate="no">
                            {Number(item.available_stock || item.current_stock).toLocaleString()}
                        </div>
                    </div>
                    <div className="px-4 py-4 border-r border-slate-200 dark:border-white/5 text-center flex flex-col items-center justify-center bg-slate-100/50 dark:bg-white/[0.02]">
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">Physical <span className="hidden sm:inline">Stock</span></div>
                        <div className="text-xl font-black text-slate-600 dark:text-gray-400 notranslate" translate="no">
                            {Number(item.current_stock).toLocaleString()}
                        </div>
                    </div>
                    <div className="px-4 py-4 sm:border-r border-slate-200 dark:border-white/5 text-center flex flex-col items-center justify-center bg-red-50/50 dark:bg-red-500/5">
                        <div className="text-[10px] text-red-600 dark:text-red-500/70 font-black uppercase tracking-widest mb-1">Total OUT</div>
                        <div className="text-xl font-black text-red-600 dark:text-red-400 notranslate" translate="no">-{totalOut.toLocaleString()}</div>
                    </div>
                    <div className="px-4 py-4 text-center flex flex-col items-center justify-center">
                        <div className="text-[10px] text-green-600 dark:text-green-500/70 font-black uppercase tracking-widest mb-1">Total IN</div>
                        <div className="text-xl font-black text-green-600 dark:text-green-400 notranslate" translate="no">+{totalIn.toLocaleString()}</div>
                    </div>
                </div>

                {/* Mobile Tabs */}
                <div className="flex md:hidden border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0f] shrink-0">
                    <button onClick={() => setMobileTab('in')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${mobileTab === 'in' ? 'text-green-600 border-b-2 border-green-500 bg-green-50/50 dark:bg-green-500/10' : 'text-slate-500 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                        <TrendingUp size={14} /> Stock In
                    </button>
                    <button onClick={() => setMobileTab('out')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${mobileTab === 'out' ? 'text-red-600 border-b-2 border-red-500 bg-red-50/50 dark:bg-red-500/10' : 'text-slate-500 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                        <TrendingDown size={14} /> Stock Out
                    </button>
                </div>

                {/* Ledger Columns */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white dark:bg-[#050508]">
                    {/* LEFT COLUMN: IN */}
                    <div className={`flex-1 min-h-0 flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-white/5 md:w-1/2 ${mobileTab === 'in' ? 'flex' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex px-6 py-3 border-b border-slate-200 dark:border-white/5 bg-green-50 dark:bg-green-500/5 items-center gap-2">
                            <TrendingUp size={16} className="text-green-600 dark:text-green-500" />
                            <span className="text-xs text-green-700 dark:text-green-400 font-black uppercase tracking-widest">Stock In</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 text-sm">
                            {loading ? (
                                <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-t-2 border-green-500 animate-spin" /></div>
                            ) : ledgerIn.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-gray-600 font-bold bg-slate-50 dark:bg-white/[0.01] m-4 rounded-2xl border border-slate-200 dark:border-white/5">No IN records</div>
                            ) : (
                                ledgerIn.map(renderRow)
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: OUT */}
                    <div className={`flex-1 min-h-0 flex-col md:w-1/2 ${mobileTab === 'out' ? 'flex' : 'hidden md:flex'}`}>
                        <div className="hidden md:flex px-6 py-3 border-b border-slate-200 dark:border-white/5 bg-red-50 dark:bg-red-500/5 items-center gap-2">
                            <TrendingDown size={16} className="text-red-600 dark:text-red-500" />
                            <span className="text-xs text-red-700 dark:text-red-400 font-black uppercase tracking-widest">Stock Out</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 text-sm">
                            {loading ? (
                                <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-t-2 border-red-500 animate-spin" /></div>
                            ) : ledgerOut.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 dark:text-gray-600 font-bold bg-slate-50 dark:bg-white/[0.01] m-4 rounded-2xl border border-slate-200 dark:border-white/5">No OUT records</div>
                            ) : (
                                ledgerOut.map(renderRow)
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* TRANSACTION DETAIL MODAL */}
            {selectedTxn && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f0f13] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl relative overflow-hidden">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${selectedTxn.change_qty > 0 ? 'bg-green-100 border-green-200 text-green-600 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400' : 'bg-red-100 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'}`}>
                                    {selectedTxn.change_qty > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedTxn.event_type}</h2>
                                    <p className="text-xs text-slate-500 dark:text-gray-500 font-mono mt-0.5">{new Date(selectedTxn.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTxn(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 dark:text-gray-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-50 dark:bg-black/20">
                            
                            {/* Qty & Ref Banner */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="bg-white dark:bg-[#15151a] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><Hash size={12}/> Net Quantity</div>
                                    <div className={`text-2xl font-black tracking-tight ${selectedTxn.change_qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {selectedTxn.change_qty > 0 ? '+' : ''}{selectedTxn.change_qty}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-[#15151a] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={12}/> Trigger Location</div>
                                    <div className="text-base font-bold text-slate-800 dark:text-white truncate mt-1">
                                        {selectedTxn.loc_id || 'System Core'}
                                    </div>
                                </div>
                            </div>

                            {/* Reference info */}
                            <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 p-5 rounded-2xl shadow-sm">
                                <div className="text-[10px] text-blue-600 dark:text-blue-400/80 font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Clipboard size={14}/> Transaction Reference</div>
                                <div className="text-slate-800 dark:text-white font-mono text-sm break-all">{selectedTxn.ref_doc || selectedTxn.notes || 'No reference documented for this event.'}</div>
                                {selectedTxn.ref_doc && selectedTxn.notes && (
                                    <div className="mt-3 text-xs text-slate-500 dark:text-gray-400 border-t border-blue-200 dark:border-white/5 pt-3">
                                        Note: {selectedTxn.notes}
                                    </div>
                                )}
                            </div>

                            {/* DO DETAILS IF APPLICABLE */}
                            {loadingDO && (
                                <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 border-dashed">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-bold animate-pulse">Fetching Delivery Route...</div>
                                </div>
                            )}

                            {doDetails && (
                                <div className="mt-4 border border-violet-200 dark:border-violet-500/20 bg-white dark:bg-violet-500/5 rounded-2xl overflow-hidden shadow-xl">
                                    <div className="px-5 py-3 border-b border-violet-100 dark:border-violet-500/10 bg-violet-50 dark:bg-violet-500/10 flex items-center gap-2">
                                        <Truck size={16} className="text-violet-600 dark:text-violet-400" />
                                        <span className="text-xs font-black text-violet-700 dark:text-violet-300 uppercase tracking-widest">Assigned Delivery (DO)</span>
                                    </div>
                                    <div className="p-5 space-y-4">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest">Route Dest</div>
                                            <div className="text-sm font-bold text-slate-800 dark:text-white leading-relaxed mt-1">{doDetails.delivery_address || doDetails.zone}</div>
                                        </div>
                                        {doDetails.customer && (
                                            <div>
                                                <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest">Customer</div>
                                                <div className="text-sm font-bold text-slate-800 dark:text-white mt-1">{doDetails.customer}</div>
                                            </div>
                                        )}
                                        {doDetails.items && doDetails.items.length > 0 && (
                                            <div className="pt-2">
                                                <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest mb-2">Truck Load Manifest</div>
                                                <div className="space-y-1.5 bg-slate-50 dark:bg-black/40 rounded-xl p-3 border border-slate-200 dark:border-white/5">
                                                    {doDetails.items.map((it: any, i: number) => (
                                                        <div key={i} className={`flex justify-between items-start text-xs ${it.sku === selectedTxn.sku ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-1 -mx-2 rounded font-bold' : 'text-slate-600 dark:text-gray-300'}`}>
                                                            <span className="truncate pr-4 leading-tight">{it.product}</span>
                                                            <span className="font-mono font-bold shrink-0">x{it.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN ---
const LiveStock: React.FC = () => {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('All');
    const [locationFilter, setLocationFilter] = useState<string>('All');
    const [selectedItem, setSelectedItem] = useState<StockRow | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
        return (localStorage.getItem('livestock_view') as 'card' | 'list') || 'card';
    });
    const [activeTab, setActiveTab] = useState<'stock' | 'reconciliation'>('stock');
    const [reconcileSku, setReconcileSku] = useState<string | null>(null);

    const handleOpenReconcile = (sku: string) => {
        setReconcileSku(sku);
        setActiveTab('reconciliation');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        localStorage.setItem('livestock_view', viewMode);
    }, [viewMode]);

    const fetchStock = async () => {
        setLoading(true);
        try {
            const [invRes, masterRes, ordersRes] = await Promise.all([
                supabase
                    .from('v2_inventory_view')
                    .select('sku, name, type, uom, loc_id, current_stock, last_updated')
                    .order('sku', { ascending: true }),
                supabase
                    .from('master_items_v2')
                    .select('sku')
                    .eq('status', 'Active'),
                supabase
                    .from('sales_orders')
                    .select('items')
                    .in('status', ['New', 'Production', 'Ready'])
            ]);

            if (invRes.error) throw invRes.error;
            if (masterRes.error) throw masterRes.error;
            if (ordersRes.error) throw ordersRes.error;

            // 仓库位置名称归一化对齐（合并 OPM Lama / opm_lama / T1 / T2 / T3 等历史别名）
            const normalizeLoc = (loc?: string) => {
                if (!loc) return 'OPM Lama';
                const l = loc.toLowerCase().trim();
                if (l === 'opm lama' || l === 'opm_lama' || l === 't1' || l === 't2' || l === 't3' || l === 't4' || l === 't5' || l === 'taiping') return 'OPM Lama';
                if (l === 'spd') return 'SPD';
                if (l === 'opm corner' || l === 'opm_corner') return 'OPM Corner';
                if (l === 'opm ali' || l === 'opm_ali') return 'OPM Ali';
                return loc.trim();
            };

            const activeSkus = new Set((masterRes.data || []).map(i => i.sku.trim()));

            // 1. 优先按 (SKU + 归一化仓库) 聚合物理库存 (仅包含 master_items_v2 中 Status = Active 的活动产品)
            const physMap = new Map<string, StockRow>();

            (invRes.data || []).forEach(r => {
                if (!r.sku) return;
                const trimmedSku = r.sku.trim();
                if (!activeSkus.has(trimmedSku)) return; // 🔒 过滤失效/测试废弃 SKU

                const normLoc = normalizeLoc(r.loc_id);
                const key = `${trimmedSku}|${normLoc}`;
                const rawQty = Number(r.current_stock) || 0;

                if (!physMap.has(key)) {
                    physMap.set(key, {
                        sku: trimmedSku,
                        name: r.name || trimmedSku,
                        type: r.type || 'FG',
                        uom: r.uom || 'ROL',
                        loc_id: normLoc,
                        current_stock: Math.max(0, rawQty),
                        reserved_stock: 0,
                        available_stock: Math.max(0, rawQty),
                        last_updated: r.last_updated || ''
                    });
                } else {
                    const existing = physMap.get(key)!;
                    existing.current_stock = Math.max(0, existing.current_stock + Math.max(0, rawQty));
                    existing.available_stock = existing.current_stock;
                    if (r.last_updated && (!existing.last_updated || new Date(r.last_updated) > new Date(existing.last_updated))) {
                        existing.last_updated = r.last_updated;
                    }
                }
            });

            // 2. 统计待出货订单预留量 (SKU + 归一化仓库)
            const reservedMap = new Map<string, number>();
            const pendingOrders = ordersRes.data || [];
            pendingOrders.forEach(order => {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        const sku = item.sku?.trim();
                        const qty = Number(item.quantity) || 0;
                        const rawLoc = item.sourceLocation || (order as any).sourceLocation || (order as any).factory_id;
                        const loc = normalizeLoc(rawLoc);
                        if (sku && activeSkus.has(sku) && qty > 0) {
                            const key = `${sku}|${loc}`;
                            reservedMap.set(key, (reservedMap.get(key) || 0) + qty);
                        }
                    });
                }
            });

            // 3. 合并计算最终物理库存、预留量与可用库存 (可用库存 = 物理库存 - 预留量，允许负数表达缺货量)
            const activeInventory: StockRow[] = [];
            physMap.forEach((item, key) => {
                const resQty = reservedMap.get(key) || 0;
                const phyStock = Math.max(0, item.current_stock);
                const availStock = phyStock - resQty;
                activeInventory.push({
                    ...item,
                    current_stock: phyStock,
                    reserved_stock: resQty,
                    available_stock: availStock
                });
            });

            setRows(activeInventory);
            setLastUpdated(new Date().toLocaleTimeString('en-GB'));
        } catch (err) {
            console.error('LiveStock fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
        const interval = setInterval(fetchStock, 30000);
        return () => clearInterval(interval);
    }, []);

    const allTypes = useMemo(() => {
        const t = [...new Set(rows.map(r => r.type).filter(Boolean))];
        return t.sort();
    }, [rows]);

    const filtered = useMemo(() => {
        const searchTerms = search.toLowerCase().trim().split(/[\s-]+/).filter(Boolean);
        
        const skuMap = new Map<string, StockRow>();

        rows.forEach(r => {
            const isMatchLoc = locationFilter === 'All' || r.loc_id === locationFilter;
            if (isMatchLoc) {
                if (!skuMap.has(r.sku)) {
                    const phy = Math.max(0, r.current_stock || 0);
                    const res = r.reserved_stock || 0;
                    skuMap.set(r.sku, {
                        ...r,
                        loc_id: locationFilter === 'All' ? undefined : locationFilter,
                        current_stock: phy,
                        reserved_stock: res,
                        available_stock: phy - res,
                        last_updated: r.last_updated || ''
                    });
                } else {
                    const item = skuMap.get(r.sku)!;
                    item.current_stock = Math.max(0, item.current_stock + Math.max(0, r.current_stock || 0));
                    item.reserved_stock = (item.reserved_stock || 0) + (r.reserved_stock || 0);
                    item.available_stock = item.current_stock - item.reserved_stock;
                    if (r.last_updated && (!item.last_updated || new Date(r.last_updated) > new Date(item.last_updated))) {
                        item.last_updated = r.last_updated;
                    }
                }
            }
        });

        // 🔒 剔除物理库存为 0 且无订单预留的无用/空占位记录
        const mergedArray = Array.from(skuMap.values());
        return mergedArray.filter(r => {
            // if (r.current_stock === 0 && (r.reserved_stock || 0) === 0) {
            //     return false;
            // }
            const matchType = typeFilter === 'All' || r.type === typeFilter;
            const matchSearch = searchTerms.length === 0 || searchTerms.every(term => 
                r.sku.toLowerCase().includes(term) || r.name.toLowerCase().includes(term)
            );
            return matchType && matchSearch;
        }).sort((a, b) => a.sku.localeCompare(b.sku));

    }, [rows, typeFilter, search, locationFilter]);

    const totalItems = filtered.length;
    const totalQty = filtered.reduce((sum, r) => sum + (r.available_stock || 0), 0);
    const lowStockCount = filtered.filter(r => (r.available_stock || 0) < LOW_STOCK_THRESHOLD).length;
    const negativeCount = filtered.filter(r => (r.available_stock || 0) < 0).length;

    const getStockColor = (qty: number) => {
        if (qty < 0) return 'text-red-600 dark:text-red-500';
        if (qty < LOW_STOCK_THRESHOLD) return 'text-amber-600 dark:text-amber-400';
        return 'text-slate-900 dark:text-white';
    };

    const getStockBadge = (qty: number) => {
        if (qty < 0) return { label: 'NEGATIVE', cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30' };
        if (qty < LOW_STOCK_THRESHOLD) return { label: 'LOW STOCK', cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' };
        return { label: 'AVAILABLE', cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-400 dark:border-green-500/30' };
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0e] text-slate-900 dark:text-white p-4 md:p-8 pb-24 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">

                {/* ── MAIN TAB SWITCHER (LIVE STOCK vs RECONCILIATION & AUDIT) ── */}
                <div className="flex items-center gap-3 p-1.5 bg-black/40 border border-white/10 rounded-2xl w-fit mb-6 shadow-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('stock')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer ${
                            activeTab === 'stock'
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-950/50'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <LayoutGrid size={15} />
                        <span>📦 实时库存大屏 (Live Stock)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setReconcileSku(null);
                            setActiveTab('reconciliation');
                        }}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 cursor-pointer ${
                            activeTab === 'reconciliation'
                                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-950/50'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Scale size={15} />
                        <span>⚖️ 产销存平衡与盘点稽核 (Reconciliation & Audit)</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-400 text-black font-black uppercase">
                            NEW
                        </span>
                    </button>
                </div>

                {/* ── CONDITIONAL RENDERING ── */}
                {activeTab === 'reconciliation' ? (
                    <StockReconciliationDashboard
                        initialSku={reconcileSku}
                        onBackToMatrix={() => setActiveTab('stock')}
                    />
                ) : (
                    <>
                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 dark:from-cyan-400 dark:via-blue-400 dark:to-violet-500 mb-1">
                            LIVE STOCK
                        </h1>
                        <p className="text-slate-500 dark:text-gray-500 text-xs font-mono flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                            LIVE · REFRESHED: {lastUpdated || '—'}
                        </p>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 min-w-[100px] shadow-sm">
                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mb-0.5">SKUs</div>
                            <div className="text-xl font-black text-slate-800 dark:text-white">{totalItems}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 min-w-[100px] shadow-sm">
                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase mb-0.5">Total Units</div>
                            <div className="text-xl font-black text-slate-800 dark:text-white">{totalQty.toLocaleString()}</div>
                        </div>
                        {lowStockCount > 0 && (
                            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 rounded-xl px-4 py-3 min-w-[100px] shadow-sm">
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase mb-0.5">Low Stock</div>
                                <div className="text-xl font-black text-amber-600 dark:text-amber-400">{lowStockCount}</div>
                            </div>
                        )}
                        {negativeCount > 0 && (
                            <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 min-w-[100px] shadow-sm">
                                <div className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase mb-0.5">Negative</div>
                                <div className="text-xl font-black text-red-600 dark:text-red-400">{negativeCount}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6 bg-slate-50 dark:bg-[#12121a] p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm relative z-10">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search SKU or name..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto custom-scrollbar  pb-1 sm:pb-0">
                        <Filter size={14} className="text-slate-400 dark:text-gray-500 shrink-0 hidden sm:block" />
                        {['All', ...allTypes].map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${typeFilter === t
                                    ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 shadow-sm'
                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:text-white'
                                    }`}
                            >
                                {t === 'All' ? 'All Types' : (TYPE_LABEL[t] || t)}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden lg:block mx-1"></div>

                    {/* LOCATION FILTER */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                        <MapPin size={14} className="text-slate-400 dark:text-gray-500 shrink-0 hidden sm:block" />
                        {['All', ...WAREHOUSES].map(w => (
                            <button
                                key={w}
                                onClick={() => setLocationFilter(w)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${locationFilter === w
                                    ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 shadow-sm'
                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:text-white'
                                    }`}
                            >
                                {w === 'All' ? 'All Locs' : w}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
                        {/* VIEW MODE TOGGLE */}
                        <div className="flex bg-slate-200 dark:bg-black/50 rounded-xl p-1 border border-slate-300 dark:border-white/10 shadow-inner">
                            <button
                                onClick={() => setViewMode('card')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white dark:bg-white/10 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-gray-300'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                        
                        <button
                            onClick={fetchStock}
                            className="p-2 sm:px-4 sm:py-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-xl flex items-center justify-center transition-colors shadow-sm"
                        >
                            <RefreshCw size={16} className={`text-cyan-600 dark:text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ── Content ── */}
                {loading && rows.length === 0 ? (
                    <div className="flex justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-24 text-slate-500 dark:text-gray-600 border border-dashed border-slate-300 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-transparent">
                        <Box size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No items found.</p>
                    </div>
                ) : viewMode === 'card' ? (
                    /* CATEGORISED HORIZONTAL ROW VIEW */
                    <div className="space-y-6">
                        {(() => {
                            const renderMiniCard = (item: StockRow) => {
                                const badge = getStockBadge(item.current_stock);
                                const styleConfig = TYPE_STYLE[item.type] || DEFAULT_STYLE;
                                return (
                                    <button
                                        key={item.sku}
                                        onClick={() => setSelectedItem(item)}
                                        className={`shrink-0 w-36 sm:w-44 relative border rounded-2xl p-3 sm:p-4 text-left cursor-pointer shadow-sm flex flex-col justify-between h-28 sm:h-32 snap-start hover:scale-[1.02] transition-transform ${styleConfig.bgCard}`}
                                    >
                                        <div>
                                            <div className="font-black text-slate-800 dark:text-white text-xs sm:text-sm tracking-tight leading-tight mb-1 line-clamp-2" title={item.name}>{item.name}</div>
                                            <div className="text-[9px] text-slate-500 dark:text-gray-400 truncate font-mono" title={item.sku}>{item.sku}</div>
                                        </div>
                                        <div className="flex items-end justify-between mt-2">
                                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                            <div className="flex flex-col items-end">
                                                <div className={`text-xl sm:text-2xl font-black tracking-tighter leading-none notranslate ${getStockColor(item.available_stock || 0)}`} translate="no">
                                                    {Number(item.available_stock || 0).toLocaleString()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 dark:text-gray-500 mt-1 font-mono tracking-tight notranslate" translate="no">
                                                    Phy: {item.current_stock} | Res: {item.reserved_stock}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            };

                            const renderCategorisedRow = (title: string, items: StockRow[]) => {
                                if (items.length === 0) return null;
                                return (
                                    <div className="mb-6">
                                        <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2 ml-1">{title}</h3>
                                        <div className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-1">
                                            {items.map(renderMiniCard)}
                                        </div>
                                    </div>
                                );
                            };

                            const isBW = (i: StockRow) => {
                                const skuUpper = i.sku.toUpperCase();
                                // 排除 SLC-1M-BLUE 等非标准衍生品，只保留截图所示的 20 种标准规格
                                if (skuUpper.includes('SLC-1M') || skuUpper.includes('BLUE')) return false;
                                return i.type === 'Bubble Wrap' || i.sku.startsWith('BW-') || /^(SL|DL)-/.test(i.sku) || i.sku.includes('HITAM');
                            };

                            const sortBW = (list: StockRow[]) => {
                                return list.sort((a, b) => {
                                    const getRank = (sku: string, name: string) => {
                                        const str = (sku + name).toUpperCase();
                                        if (str.includes('FULL') || str.includes('100CM') || str.includes('MERAH')) return 1;
                                        if (str.includes('HALF') || str.includes('50CM') || str.includes('50 CM') || str.includes('OREN')) return 2;
                                        if (str.includes('33CM') || str.includes('33 CM')) return 3;
                                        if (str.includes('25CM') || str.includes('25 CM')) return 4;
                                        if (str.includes('20CM') || str.includes('20 CM')) return 5;
                                        return 99;
                                    };
                                    const rankA = getRank(a.sku, a.name);
                                    const rankB = getRank(b.sku, b.name);
                                    if (rankA !== rankB) return rankA - rankB;
                                    return a.sku.localeCompare(b.sku);
                                });
                            };

                            const slClear = sortBW(filtered.filter(i => isBW(i) && (i.sku.includes('-SL-CLR') || i.name.toUpperCase().includes('MERAH') || i.name.toUpperCase().includes('OREN') || (i.sku.startsWith('SL-') && !i.sku.includes('HITAM') && !i.sku.includes('BLK')))));
                            const dlClear = sortBW(filtered.filter(i => isBW(i) && (i.sku.includes('-DL-CLR') || (i.sku.startsWith('DL-') && !i.sku.includes('HITAM') && !i.sku.includes('BLK') && !i.sku.includes('HITAM-FULL')) || i.sku === 'DL-FULL' || i.sku === 'DL-HALF')));
                            const slHitam = sortBW(filtered.filter(i => isBW(i) && (i.sku.includes('-SL-BLK') || (i.sku.startsWith('SL-') && i.sku.includes('HITAM')))));
                            const dlHitam = sortBW(filtered.filter(i => isBW(i) && (i.sku.includes('-DL-BLK') || (i.sku.startsWith('DL-') && i.sku.includes('HITAM')) || i.sku.startsWith('HITAM-') || i.sku === 'DL-HITAM-FULL')));
                            
                            const stretchFilms = filtered.filter(i => !isBW(i) && (i.type === 'Stretch Film' || i.sku.startsWith('SF-')));
                            const tapes = filtered.filter(i => !isBW(i) && i.type?.includes('Tape'));
                            const others = filtered.filter(i => !isBW(i) && i.type !== 'Stretch Film' && !i.sku.startsWith('SF-') && !i.type?.includes('Tape'));

                            return (
                                <>
                                    {/* BUBBLE WRAP SECTION (仅精准展示 4 行共 20 款标准物料) */}
                                    {(slClear.length > 0 || dlClear.length > 0 || slHitam.length > 0 || dlHitam.length > 0) && (
                                        <div className="mb-8 bg-slate-50/50 dark:bg-[#12121a]/30 p-3 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-white/5">
                                            <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 mb-4 border-b border-cyan-500/20 pb-2 flex items-center gap-2">📦 Bubblewrap 分类</h2>
                                            {renderCategorisedRow('SL (Single Layer Clear)', slClear)}
                                            {renderCategorisedRow('DL (Double Layer Clear)', dlClear)}
                                            {renderCategorisedRow('SL Hitam (Single Layer Black)', slHitam)}
                                            {renderCategorisedRow('DL Hitam (Double Layer Black)', dlHitam)}
                                        </div>
                                    )}
                                    
                                    {/* OTHER SECTIONS */}
                                    {(stretchFilms.length > 0 || tapes.length > 0 || others.length > 0) && (
                                        <div className="p-3 sm:p-5">
                                            <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 mb-4 border-b border-slate-500/20 pb-2 flex items-center gap-2">📦 其它分类 (Others)</h2>
                                            {renderCategorisedRow('Stretch Films', stretchFilms)}
                                            {renderCategorisedRow('Tapes', tapes)}
                                            {renderCategorisedRow('Other Items', others)}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                ) : (
                    /* DENSE LIST VIEW (Mobile Optimized) */
                    <div className="flex flex-col space-y-2 bg-slate-50 dark:bg-black/20 p-2 rounded-2xl border border-slate-200 dark:border-white/5">
                        {filtered.map((item, idx) => {
                            const styleConfig = TYPE_STYLE[item.type] || DEFAULT_STYLE;
                            return (
                                <button 
                                    key={item.sku}
                                    onClick={() => setSelectedItem(item)} 
                                    className={`flex items-center justify-between p-3 sm:px-4 bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-left active:scale-[0.99] transition-all shadow-sm ${idx % 2 === 0 ? 'bg-white dark:bg-[#12121a]' : 'bg-slate-50/50 dark:bg-[#12121a]/50'}`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg w-16 text-center shrink-0 border shadow-sm ${styleConfig.badge}`}>
                                            {item.type}
                                        </span>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm truncate w-full leading-tight">
                                                {item.name}
                                            </div>
                                            {/* Hide SKU on extremely small screens to save space, show faintly otherwise */}
                                            <div className="text-[10px] text-slate-400 dark:text-gray-600 font-mono truncate hidden sm:block mt-0.5">
                                                {item.sku}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 pl-3 border-l border-slate-200 dark:border-white/10">
                                        <div className={`text-lg sm:text-xl font-black tracking-tighter notranslate ${getStockColor(item.available_stock || 0)}`} translate="no">
                                            {Number(item.available_stock || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono mt-0.5 notranslate" translate="no">
                                            P:{item.current_stock} R:{item.reserved_stock}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
                    </>
                )}
            </div>

            {/* Detail Panel */}
            {selectedItem && (
                <DetailPanel
                    item={selectedItem}
                    locFilter={locationFilter}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
};

export default LiveStock;
