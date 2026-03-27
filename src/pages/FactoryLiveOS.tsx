import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
    Activity, Cpu, Zap, AlertTriangle, X, Box, Wifi, WifiOff, ChevronRight, RefreshCw,
    Truck, Package, BarChart3, ArrowUpDown, FileBarChart, ClipboardList, TrendingDown,
    Plus, Calendar, Check, Clock, Play, Trash2
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MachineCard {
    machine_id: string;
    name: string;
    factory_id: string;
    base_width: number;
    type: string;
    // IoT
    last_heartbeat: string | null;
    iot_mac: string | null;
    // Live
    status: 'Online' | 'Offline';
    isProducing: boolean;        // has an active SKU loaded in machine_active_products
    today_count: number;
    current_sku: string | null;
    total_count: number;
    reboot_count: number;
    gaps: { start: string, end: string, duration_min: number }[];
}

interface ProductionLogRow {
    log_id: string;
    created_at: string;
    machine_id: string;
    sku: string | null;
    output_qty: number;
}

interface StockItem {
    sku: string;
    current_stock: number;
    name?: string;
}

interface OrderSummaryData {
    total: number;
    pending: number;
    shipped: number;
    delivered: number;
    driverSummary: { name: string; count: number; driverId: string }[];
}

interface MachineProductionBreakdown {
    machine_id: string;
    machine_name: string;
    skus: { sku: string; qty: number }[];
    total: number;
}

interface ScheduleTask {
    id: string;
    machine_id: string;
    sku: string;
    target_qty: number;
    scheduled_time: string | null;
    notes: string | null;
    status: 'Pending' | 'In-Progress' | 'Done' | 'Cancelled';
    created_by: string | null;
    created_at: string;
}

interface SkuOption {
    sku: string;
    name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusColor = (status: MachineCard['status'], isProducing?: boolean) => {
    if (status === 'Online' && isProducing) return { dot: 'bg-emerald-400', ring: 'border-emerald-500/40', glow: 'shadow-emerald-500/20', text: 'text-emerald-400' };
    if (status === 'Online') return { dot: 'bg-cyan-400', ring: 'border-cyan-500/30', glow: 'shadow-cyan-500/10', text: 'text-cyan-400' };
    return { dot: 'bg-red-500', ring: 'border-red-500/30', glow: 'shadow-red-500/10', text: 'text-red-400' };
};

const timeSince = (iso: string | null): string => {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const resolveStatus = (heartbeatIso: string | null, hasActiveSku: boolean): { status: MachineCard['status']; isProducing: boolean } => {
    const now = Date.now();
    const hbDiff = heartbeatIso ? now - new Date(heartbeatIso).getTime() : Infinity;
    // A machine is considered producing if it has an active SKU loaded
    const isProducing = hasActiveSku;
    const status: MachineCard['status'] = hbDiff < 180000 ? 'Online' : 'Offline'; // heartbeat < 3 min = Online
    return { status, isProducing };
};

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const DetailPanel = ({ machine, onClose }: { machine: MachineCard; onClose: () => void }) => {
    const [logs, setLogs] = useState<ProductionLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const c = getStatusColor(machine.status, machine.isProducing);

    useEffect(() => {
        setLoading(true);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        supabase.from('production_logs_v2')
            .select('log_id, created_at, machine_id, sku, output_qty')
            .eq('machine_id', machine.machine_id)
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: false })
            .limit(30)
            .then(({ data }) => { setLogs((data as any) || []); setLoading(false); });
    }, [machine.machine_id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className={`relative w-full max-w-lg h-full bg-[#0a0a0f] border-l ${c.ring} flex flex-col overflow-hidden`}
                style={{ boxShadow: `-20px 0 60px rgba(0,0,0,0.8)` }}>

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot} ${machine.status === 'Online' ? 'animate-pulse' : ''}`} />
                            <span className={`text-xs font-bold uppercase tracking-widest ${c.text}`}>
                                {machine.status}{machine.isProducing ? ' · Producing' : ''}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-white leading-tight">{machine.name}</h2>
                        <div className="flex gap-3 mt-2">
                            <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">{machine.machine_id}</span>
                            <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">{machine.base_width}cm wide</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-px bg-white/5">
                    {[
                        { label: 'Today', value: machine.today_count.toLocaleString(), unit: 'rolls' },
                        { label: 'Reboots', value: machine.reboot_count, unit: 'times' },
                        { label: 'Uptime', value: machine.gaps.length === 0 ? '100%' : `${machine.gaps.length} gaps`, unit: 'today' },
                    ].map(s => (
                        <div key={s.label} className="bg-[#0a0a0f] px-4 py-3">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">{s.label}</div>
                            <div className="text-2xl font-black text-white">{s.value}</div>
                            <div className="text-[10px] text-gray-600">{s.unit}</div>
                        </div>
                    ))}
                </div>

                {/* Current SKU */}
                {machine.current_sku && (
                    <div className="px-6 py-3 border-b border-white/5 bg-cyan-500/5">
                        <div className="text-[10px] text-cyan-500 uppercase tracking-widest mb-0.5">Active SKU</div>
                        <div className="font-mono text-cyan-300 font-bold text-sm">{machine.current_sku}</div>
                    </div>
                )}

                {/* IoT Info */}
                <div className="px-6 py-3 border-b border-white/5 flex gap-4">
                    <div className="flex-1">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Heartbeat</div>
                        <div className="text-sm text-white font-mono">{timeSince(machine.last_heartbeat)}</div>
                    </div>
                    {machine.iot_mac && (
                        <div className="flex-1">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">MAC</div>
                            <div className="text-xs text-gray-400 font-mono">{machine.iot_mac}</div>
                        </div>
                    )}
                </div>

                {/* Downtime Analysis timeline */}
                {machine.gaps && machine.gaps.length > 0 && (
                    <div className="px-6 py-4 bg-orange-500/5 border-b border-orange-500/10">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle size={14} className="text-orange-500" />
                            <span className="text-[10px] text-orange-500 uppercase tracking-widest font-bold">Downtime Analysis</span>
                        </div>
                        <div className="space-y-2">
                            {machine.gaps.map((g, i) => (
                                <div key={i} className="flex items-center justify-between bg-black/40 rounded-lg px-3 py-2 border border-white/5">
                                    <div className="text-xs font-mono text-gray-400">
                                        {g.start} <span className="text-gray-600">→</span> {g.end}
                                    </div>
                                    <div className="text-xs font-bold text-orange-400">
                                        {g.duration_min} min
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Logs */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="px-6 py-3 border-b border-white/5">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest">Today's Production Logs</span>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center p-10">
                            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-8 text-center text-gray-600 text-sm">No production logs today</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {logs.map(log => (
                                <div key={log.log_id} className="px-6 py-3 flex items-center justify-between hover:bg-white/2">
                                    <div>
                                        <div className="text-xs text-gray-400 font-mono">
                                            {new Date(log.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        {log.sku && log.sku.trim().toUpperCase() !== 'UNKNOWN' ? (
                                            <div className="text-[10px] text-gray-600 font-mono mt-0.5">{log.sku}</div>
                                        ) : machine.current_sku ? (
                                            <div className="text-[10px] text-gray-600 font-mono mt-0.5">{machine.current_sku}</div>
                                        ) : null}
                                    </div>
                                    <div className="text-sm font-black text-white">
                                        +{log.output_qty || 0}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Machine Card ─────────────────────────────────────────────────────────────

const MachineCardView = ({ machine, onClick }: { machine: MachineCard; onClick: () => void }) => {
    const c = getStatusColor(machine.status, machine.isProducing);
    const isDL = machine.name.includes('Double Layer');

    return (
        <button
            onClick={onClick}
            className={`group relative bg-[#0d0d14] border ${c.ring} rounded-2xl p-5 text-left transition-all duration-300
                        hover:scale-[1.02] hover:shadow-xl ${c.glow} flex flex-col gap-4 overflow-hidden`}
        >
            {/* Background glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 ${machine.isProducing ? 'bg-emerald-500' :
                machine.status === 'Online' ? 'bg-cyan-500' : 'bg-transparent'
                }`} />

            {/* Top Row */}
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${c.dot} ${machine.status === 'Online' ? 'animate-pulse' : ''}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text}`}>
                            {machine.status}{machine.isProducing ? ' · Producing' : ''}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">· {machine.factory_id}</span>
                    </div>
                    <h3 className="text-white font-black text-base leading-tight">{machine.name}</h3>
                    <span className="text-[10px] text-gray-600 font-mono">{machine.machine_id}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {isDL ? (
                        <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">2L</span>
                    ) : (
                        <span className="text-[9px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase">1L</span>
                    )}
                    <span className="text-[9px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded font-mono">{machine.base_width}cm</span>
                </div>
            </div>

            {/* Count */}
            <div className="relative z-10">
                <div className="text-4xl font-black text-white tracking-tight leading-none">
                    {machine.today_count.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">rolls today</div>
            </div>

            {/* Current SKU */}
            {machine.current_sku ? (
                <div className="relative z-10 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-1.5">
                    <div className="text-[9px] text-cyan-500 uppercase tracking-widest mb-0.5">Running</div>
                    <div className="font-mono text-cyan-300 text-xs font-bold truncate">{machine.current_sku}</div>
                </div>
            ) : (
                <div className="relative z-10 bg-white/3 border border-white/5 rounded-lg px-3 py-1.5">
                    <div className="text-[10px] text-gray-600">No active product</div>
                </div>
            )}

            {/* Footer */}
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {machine.status !== 'Offline' ? (
                        <Wifi size={11} className={c.text} />
                    ) : (
                        <WifiOff size={11} className="text-red-500" />
                    )}
                    <span className="text-[10px] text-gray-500">{timeSince(machine.last_heartbeat)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${machine.reboot_count > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                        {machine.reboot_count === 0 ? 'No alerts' : `${machine.reboot_count} alerts`}
                    </span>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>
        </button>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface FactoryLiveOSProps {
    onNavigate?: (page: string) => void;
}

const FactoryLiveOS: React.FC<FactoryLiveOSProps> = ({ onNavigate }) => {
    const [machines, setMachines] = useState<MachineCard[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<MachineCard | null>(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [clock, setClock] = useState(new Date());

    // Manager Dashboard Data
    const [orderSummary, setOrderSummary] = useState<OrderSummaryData>({ total: 0, pending: 0, shipped: 0, delivered: 0, driverSummary: [] });
    const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
    const [productionBreakdown, setProductionBreakdown] = useState<MachineProductionBreakdown[]>([]);

    // Production Schedule
    const [schedule, setSchedule] = useState<ScheduleTask[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [skuList, setSkuList] = useState<SkuOption[]>([]);
    const [formMachine, setFormMachine] = useState('');
    const [formSku, setFormSku] = useState('');
    const [formQty, setFormQty] = useState(100);
    const [formTime, setFormTime] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [skuSearch, setSkuSearch] = useState('');

    // Clock tick
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // ─── Machine Data ─────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

        const [machinesRes, iotRes, logsRes, activeRes, ordersRes, stockRes, driversRes] = await Promise.all([
            supabase.from('sys_machines_v2').select('machine_id, name, factory_id, base_width, type').order('factory_id'),
            supabase.from('iot_device_configs').select('mac_address, machine_id, last_heartbeat'),
            supabase.from('production_logs_v2').select('machine_id, output_qty, created_at, sku, log_id').gte('created_at', todayISO),
            supabase.from('machine_active_products').select('machine_id, product_sku'),
            // Manager: Today's orders
            supabase.from('sales_orders').select('id, status, driver_id, items, deadline, order_date')
                .neq('status', 'Cancelled')
                .or(`deadline.eq.${todayStr},order_date.eq.${todayStr}`),
            // Manager: Stock levels
            supabase.rpc('get_live_stock_viewer'),
            // Manager: Driver names
            supabase.from('users_public').select('id, name, email, role').eq('role', 'Driver'),
        ]);

        // ─── Machine Processing (existing) ────────────────────────────────
        const iotMap: Record<string, { last_heartbeat: string; mac: string }> = {};
        (iotRes.data || []).forEach((d: any) => {
            iotMap[d.machine_id] = { last_heartbeat: d.last_heartbeat, mac: d.mac_address };
        });

        const activeMap: Record<string, string> = {};
        (activeRes.data || []).forEach((d: any) => { if (d.product_sku) activeMap[d.machine_id] = d.product_sku; });

        // Aggregate logs
        const countMap: Record<string, number> = {};
        const rebootMap: Record<string, number> = {};
        const gapMap: Record<string, { start: string, end: string, duration_min: number }[]> = {};
        const lastTimeMap: Record<string, number> = {};

        (logsRes.data || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .forEach((log: any) => {
                const id = log.machine_id;
                const t = new Date(log.created_at).getTime();

                const count = Number(log.output_qty) || 0;
                if (count > 0) countMap[id] = (countMap[id] || 0) + count;

                if (lastTimeMap[id]) {
                    const diffMin = Math.round((t - lastTimeMap[id]) / 60000);
                    if (diffMin > 10) {
                        if (!gapMap[id]) gapMap[id] = [];
                        gapMap[id].unshift({
                            start: new Date(lastTimeMap[id]).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
                            end: new Date(t).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
                            duration_min: diffMin
                        });
                    }
                }
                lastTimeMap[id] = t;
            });

        const cards: MachineCard[] = (machinesRes.data || [])
            .filter((m: any) => !(m.type === 'Extruder' && m.base_width === 50)) // exclude stretch film
            .map((m: any) => ({
                machine_id: m.machine_id,
                name: m.name,
                factory_id: m.factory_id,
                base_width: m.base_width,
                type: m.type,
                last_heartbeat: iotMap[m.machine_id]?.last_heartbeat || null,
                iot_mac: iotMap[m.machine_id]?.mac || null,
                ...(() => { const r = resolveStatus(iotMap[m.machine_id]?.last_heartbeat || null, !!activeMap[m.machine_id]); return { status: r.status, isProducing: r.isProducing }; })(),
                today_count: countMap[m.machine_id] || 0,
                current_sku: activeMap[m.machine_id] || null,
                reboot_count: rebootMap[m.machine_id] || 0,
                gaps: gapMap[m.machine_id] || [],
                total_count: 0,
            }));

        setMachines(cards);

        // ─── Manager: Production Breakdown by Machine × SKU ───────────────
        const machineSkuMap: Record<string, Record<string, number>> = {};
        (logsRes.data || []).forEach((log: any) => {
            const mid = log.machine_id;
            const sku = (log.sku && log.sku.trim().toUpperCase() !== 'UNKNOWN') ? log.sku : (activeMap[mid] || 'Unknown');
            const qty = Number(log.output_qty) || 0;
            if (qty <= 0) return;
            if (!machineSkuMap[mid]) machineSkuMap[mid] = {};
            machineSkuMap[mid][sku] = (machineSkuMap[mid][sku] || 0) + qty;
        });

        const machineNameMap: Record<string, string> = {};
        (machinesRes.data || []).forEach((m: any) => { machineNameMap[m.machine_id] = m.name; });

        const breakdown: MachineProductionBreakdown[] = Object.entries(machineSkuMap)
            .map(([mid, skuMap]) => ({
                machine_id: mid,
                machine_name: machineNameMap[mid] || mid,
                skus: Object.entries(skuMap).map(([sku, qty]) => ({ sku, qty })).sort((a, b) => b.qty - a.qty),
                total: Object.values(skuMap).reduce((s, v) => s + v, 0)
            }))
            .sort((a, b) => b.total - a.total);

        setProductionBreakdown(breakdown);

        // ─── Manager: Order Processing ────────────────────────────────────
        const orders = ordersRes.data || [];
        const driverNameMap: Record<string, string> = {};
        (driversRes.data || []).forEach((d: any) => {
            driverNameMap[d.id] = d.name || d.email?.split('@')[0] || 'Unknown';
        });

        const pending = orders.filter(o => o.status === 'New' || o.status === 'Planned' || o.status === 'In-Production' || o.status === 'Ready-to-Ship').length;
        const shipped = orders.filter(o => o.status === 'Shipped').length;
        const delivered = orders.filter(o => o.status === 'Delivered').length;

        // Driver summary
        const driverCountMap: Record<string, number> = {};
        orders.filter(o => o.driver_id && o.status !== 'Delivered').forEach(o => {
            driverCountMap[o.driver_id] = (driverCountMap[o.driver_id] || 0) + 1;
        });

        const driverSummary = Object.entries(driverCountMap)
            .map(([driverId, count]) => ({
                driverId,
                name: driverNameMap[driverId] || 'Unknown',
                count
            }))
            .sort((a, b) => b.count - a.count);

        setOrderSummary({ total: orders.length, pending, shipped, delivered, driverSummary });

        // ─── Manager: Low Stock ───────────────────────────────────────────
        const stockData = stockRes.data || [];
        const lowStock = stockData
            .filter((item: any) => item.current_stock < 20 && item.current_stock >= 0)
            .map((item: any) => ({ sku: item.sku, current_stock: item.current_stock, name: item.name || item.sku }))
            .sort((a: StockItem, b: StockItem) => a.current_stock - b.current_stock);
        setLowStockItems(lowStock);

        // ─── Manager: Production Schedule ─────────────────────────────────
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const { data: scheduleData } = await supabase.from('production_schedule')
            .select('*')
            .gte('created_at', todayStart.toISOString())
            .neq('status', 'Cancelled')
            .order('scheduled_time', { ascending: true, nullsFirst: false });
        if (scheduleData) setSchedule(scheduleData as ScheduleTask[]);

        // SKU list for form
        if (skuList.length === 0) {
            const { data: items } = await supabase.from('master_items_v2')
                .select('sku, name')
                .eq('status', 'Active')
                .order('name');
            if (items) setSkuList(items.map((i: any) => ({ sku: i.sku, name: i.name })));
        }

        setLastUpdate(new Date());
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadData, 30000);

        // Realtime: new production log → refresh
        const channel = supabase.channel('factory-live-os')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs_v2' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_device_configs' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_active_products' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_schedule' }, loadData)
            .subscribe();

        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [loadData]);

    const onlineCount = machines.filter(m => m.status === 'Online').length;
    const producingCount = machines.filter(m => m.isProducing).length;
    const totalRolls = machines.reduce((s, m) => s + m.today_count, 0);
    const alertCount = machines.reduce((s, m) => s + m.reboot_count, 0);

    const navigate = (page: string) => {
        if (onNavigate) onNavigate(page);
    };

    // ─── Schedule Handlers ────────────────────────────────────────────────
    const handleAddTask = async () => {
        if (!formMachine || !formSku || formQty <= 0) return;
        // Convert HH:MM time string to today's full timestamp
        let scheduledTimestamp: string | null = null;
        if (formTime) {
            const [h, m] = formTime.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            scheduledTimestamp = d.toISOString();
        }
        await supabase.from('production_schedule').insert({
            machine_id: formMachine,
            sku: formSku,
            target_qty: formQty,
            scheduled_time: scheduledTimestamp,
            notes: formNotes || null,
            status: 'Pending',
            created_by: 'Manager',
        });
        setShowScheduleModal(false);
        setFormMachine('');
        setFormSku('');
        setFormQty(100);
        setFormTime('');
        setFormNotes('');
        setSkuSearch('');
        loadData();
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        await supabase.from('production_schedule').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        loadData();
    };

    const handleDeleteTask = async (id: string) => {
        await supabase.from('production_schedule').update({ status: 'Cancelled', updated_at: new Date().toISOString() }).eq('id', id);
        loadData();
    };

    const getMachineName = (mid: string) => machines.find(m => m.machine_id === mid)?.name || mid;

    const filteredSkus = skuSearch
        ? skuList.filter(s => s.sku.toLowerCase().includes(skuSearch.toLowerCase()) || s.name.toLowerCase().includes(skuSearch.toLowerCase())).slice(0, 8)
        : skuList.slice(0, 8);

    return (
        <div className="min-h-screen bg-[#070710] text-white flex flex-col">

            {/* ── HEADER ── */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <Activity size={16} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">Factory Live OS</h1>
                        <p className="text-[10px] text-gray-500 font-mono">
                            {clock.toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                {/* Clock */}
                <div className="text-2xl font-black font-mono text-white tabular-nums tracking-wider">
                    {clock.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </div>

                {/* Refresh */}
                <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs">
                    <RefreshCw size={12} />
                    <span className="text-[10px] font-mono">{timeSince(lastUpdate.toISOString())}</span>
                </button>
            </header>

            {/* ── SUMMARY BAR (6-col) ── */}
            <div className="border-b border-white/5 bg-black/20 px-6 py-3 grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                    { label: 'Online', value: onlineCount, icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { label: 'Producing', value: producingCount, icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Rolls Today', value: totalRolls.toLocaleString(), icon: Box, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { label: 'Orders', value: orderSummary.total, icon: ClipboardList, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Low Stock', value: lowStockItems.length, icon: TrendingDown, color: lowStockItems.length > 0 ? 'text-orange-400' : 'text-gray-600', bg: lowStockItems.length > 0 ? 'bg-orange-500/10' : 'bg-white/5' },
                    { label: 'Alerts', value: alertCount, icon: AlertTriangle, color: alertCount > 0 ? 'text-orange-400' : 'text-gray-600', bg: alertCount > 0 ? 'bg-orange-500/10' : 'bg-white/5' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl px-4 py-2.5 flex items-center gap-3`}>
                        <s.icon size={18} className={s.color} />
                        <div>
                            <div className={`text-xl font-black ${s.color} leading-none`}>{s.value}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 p-6 overflow-y-auto space-y-8">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-gray-500 text-sm font-mono">Loading machines…</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── MACHINE GRID ── */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
                                    <Cpu size={14} /> Machine Status
                                </h2>
                                <div className="text-[10px] text-gray-700 font-mono uppercase tracking-widest">
                                    {machines.filter(m => m.factory_id === 'N1' || m.factory_id === 'N2').length} Nilai · {machines.filter(m => m.factory_id === 'T1').length} Taiping
                                </div>
                            </div>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                                {machines.map(m => (
                                    <MachineCardView key={m.machine_id} machine={m} onClick={() => setSelectedMachine(m)} />
                                ))}
                            </div>
                        </section>

                        {/* ── PRODUCTION BREAKDOWN ── */}
                        {productionBreakdown.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
                                        <BarChart3 size={14} /> Today's Production Breakdown
                                    </h2>
                                    <div className="text-[10px] text-gray-600 font-mono">
                                        {productionBreakdown.reduce((s, m) => s + m.total, 0).toLocaleString()} rolls total
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {productionBreakdown.map(machine => (
                                        <div key={machine.machine_id} className="bg-[#0d0d14] border border-white/5 rounded-xl overflow-hidden">
                                            {/* Machine Header */}
                                            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                                <div>
                                                    <div className="text-sm font-bold text-white">{machine.machine_name}</div>
                                                    <div className="text-[10px] text-gray-600 font-mono">{machine.machine_id}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-black text-cyan-400">{machine.total.toLocaleString()}</div>
                                                    <div className="text-[9px] text-gray-600 uppercase tracking-widest">rolls</div>
                                                </div>
                                            </div>
                                            {/* SKU Rows */}
                                            <div className="divide-y divide-white/5">
                                                {machine.skus.map(({ sku, qty }) => {
                                                    const pct = machine.total > 0 ? (qty / machine.total) * 100 : 0;
                                                    return (
                                                        <div key={sku} className="px-4 py-2.5 flex items-center gap-3 relative overflow-hidden">
                                                            {/* Progress bar background */}
                                                            <div
                                                                className="absolute inset-y-0 left-0 bg-cyan-500/5"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                            <div className="relative z-10 flex-1 min-w-0">
                                                                <div className="text-xs font-mono text-gray-300 truncate" title={sku}>{sku}</div>
                                                            </div>
                                                            <div className="relative z-10 flex items-center gap-2">
                                                                <div className="text-xs text-gray-500 font-mono w-10 text-right">{pct.toFixed(0)}%</div>
                                                                <div className="text-sm font-black text-white w-12 text-right">{qty}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── PRODUCTION SCHEDULE ── */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
                                    <Calendar size={14} /> Production Schedule
                                    {schedule.filter(t => t.status === 'Pending').length > 0 && (
                                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                            {schedule.filter(t => t.status === 'Pending').length} pending
                                        </span>
                                    )}
                                </h2>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                                >
                                    <Plus size={14} /> 排产
                                </button>
                            </div>

                            {schedule.length === 0 ? (
                                <div className="bg-[#0d0d14] border border-dashed border-white/10 rounded-xl p-8 text-center">
                                    <Calendar size={24} className="text-gray-700 mx-auto mb-2" />
                                    <div className="text-sm text-gray-600">No production tasks scheduled today</div>
                                    <button
                                        onClick={() => setShowScheduleModal(true)}
                                        className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-bold"
                                    >
                                        + Create First Task
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {schedule.map(task => {
                                        const statusConfig = {
                                            'Pending': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', icon: Clock },
                                            'In-Progress': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: Play },
                                            'Done': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: Check },
                                            'Cancelled': { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: X },
                                        }[task.status] || { bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400', icon: Clock };
                                        const StatusIcon = statusConfig.icon;

                                        return (
                                            <div key={task.id} className={`${statusConfig.bg} border ${statusConfig.border} rounded-xl px-4 py-3 flex items-center gap-4`}>
                                                {/* Status Icon */}
                                                <div className={`w-8 h-8 rounded-lg ${statusConfig.bg} flex items-center justify-center`}>
                                                    <StatusIcon size={16} className={statusConfig.text} />
                                                </div>

                                                {/* Machine */}
                                                <div className="w-36">
                                                    <div className="text-xs font-bold text-white">{getMachineName(task.machine_id)}</div>
                                                    <div className="text-[10px] text-gray-600 font-mono">{task.machine_id}</div>
                                                </div>

                                                {/* SKU */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-mono text-cyan-300 truncate" title={task.sku}>{task.sku}</div>
                                                    {task.notes && <div className="text-[10px] text-gray-500 truncate">{task.notes}</div>}
                                                </div>

                                                {/* Qty */}
                                                <div className="text-right w-20">
                                                    <div className="text-lg font-black text-white">{task.target_qty}</div>
                                                    <div className="text-[9px] text-gray-600 uppercase">target</div>
                                                </div>

                                                {/* Time */}
                                                <div className="text-right w-16">
                                                    {task.scheduled_time ? (
                                                        <div className="text-xs font-mono text-gray-400">
                                                            {new Date(task.scheduled_time).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-gray-700">No time</div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-1">
                                                    {task.status === 'Pending' && (
                                                        <button onClick={() => handleUpdateStatus(task.id, 'In-Progress')} className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors" title="Start">
                                                            <Play size={12} />
                                                        </button>
                                                    )}
                                                    {task.status === 'In-Progress' && (
                                                        <button onClick={() => handleUpdateStatus(task.id, 'Done')} className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors" title="Complete">
                                                            <Check size={12} />
                                                        </button>
                                                    )}
                                                    {task.status !== 'Done' && (
                                                        <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title="Cancel">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* ── TODAY'S DELIVERY OVERVIEW ── */}
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2">
                                    <Truck size={14} /> Today's Delivery
                                </h2>
                                {onNavigate && (
                                    <button onClick={() => navigate('delivery')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                                        View All <ChevronRight size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Status Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: 'Pending', value: orderSummary.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                                    { label: 'Shipped', value: orderSummary.shipped, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                                    { label: 'Delivered', value: orderSummary.delivered, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                                    { label: 'Total', value: orderSummary.total, color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' },
                                ].map(s => (
                                    <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3`}>
                                        <div className={`text-3xl font-black ${s.color} leading-none`}>{s.value}</div>
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Driver Assignment Summary */}
                            {orderSummary.driverSummary.length > 0 && (
                                <div className="bg-[#0d0d14] border border-white/5 rounded-xl p-4">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">Driver Assignments</div>
                                    <div className="flex flex-wrap gap-2">
                                        {orderSummary.driverSummary.map(d => (
                                            <div key={d.driverId} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-xs font-bold text-white">
                                                    {d.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white leading-none">{d.name}</div>
                                                    <div className="text-[10px] text-blue-400 font-mono">{d.count} trips</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* ── LOW STOCK ALERTS ── */}
                        {lowStockItems.length > 0 && (
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xs font-black uppercase tracking-[0.15em] text-orange-400 flex items-center gap-2">
                                        <AlertTriangle size={14} /> Low Stock Alerts
                                        <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold">{lowStockItems.length}</span>
                                    </h2>
                                    {onNavigate && (
                                        <button onClick={() => navigate('livestock')} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                                            Live Stock <ChevronRight size={12} />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {lowStockItems.slice(0, 12).map(item => {
                                        const isCritical = item.current_stock < 5;
                                        return (
                                            <div key={item.sku} className={`rounded-xl px-3 py-2.5 border ${isCritical
                                                ? 'bg-red-500/10 border-red-500/30'
                                                : 'bg-orange-500/10 border-orange-500/20'
                                                }`}>
                                                <div className={`text-[10px] font-mono truncate mb-1 ${isCritical ? 'text-red-400' : 'text-orange-400'}`} title={item.sku}>
                                                    {item.name || item.sku}
                                                </div>
                                                <div className={`text-2xl font-black leading-none ${isCritical ? 'text-red-400' : 'text-orange-300'}`}>
                                                    {item.current_stock}
                                                </div>
                                                {isCritical && (
                                                    <div className="text-[9px] text-red-500 font-bold uppercase mt-1 animate-pulse">CRITICAL</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ── QUICK ACTIONS ── */}
                        {onNavigate && (
                            <section>
                                <h2 className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 flex items-center gap-2 mb-4">
                                    <Zap size={14} /> Quick Actions
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {[
                                        { id: 'delivery', label: 'Trip Management', icon: Truck, color: 'from-blue-600 to-cyan-600' },
                                        { id: 'order-summary', label: 'Daily Prep', icon: FileBarChart, color: 'from-purple-600 to-pink-600' },
                                        { id: 'livestock', label: 'Live Stock', icon: BarChart3, color: 'from-emerald-600 to-teal-600' },
                                        { id: 'stock-movement', label: 'Stock Movement', icon: ArrowUpDown, color: 'from-orange-600 to-amber-600' },
                                        { id: 'production', label: 'Production Logs', icon: Package, color: 'from-slate-600 to-zinc-600' },
                                    ].map(action => (
                                        <button
                                            key={action.id}
                                            onClick={() => navigate(action.id)}
                                            className="group bg-[#0d0d14] border border-white/5 hover:border-white/20 rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.02]"
                                        >
                                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                                <action.icon size={18} className="text-white" />
                                            </div>
                                            <div className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{action.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>

            {/* ── DETAIL PANEL ── */}
            {selectedMachine && (
                <DetailPanel machine={selectedMachine} onClose={() => setSelectedMachine(null)} />
            )}

            {/* ── SCHEDULE MODAL ── */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)} />
                    <div className="relative bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <Calendar size={16} className="text-blue-400" /> 新增排产任务
                            </h3>
                            <button onClick={() => setShowScheduleModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-6 space-y-4">
                            {/* Machine Select */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 block">Machine *</label>
                                <select
                                    value={formMachine}
                                    onChange={e => setFormMachine(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none"
                                >
                                    <option value="">Select Machine...</option>
                                    {machines.map(m => (
                                        <option key={m.machine_id} value={m.machine_id}>
                                            {m.name} ({m.machine_id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* SKU Search */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 block">Product SKU *</label>
                                <input
                                    type="text"
                                    placeholder="Search SKU or product name..."
                                    value={formSku || skuSearch}
                                    onChange={e => { setSkuSearch(e.target.value); setFormSku(''); }}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none font-mono"
                                />
                                {skuSearch && !formSku && (
                                    <div className="mt-1 bg-[#0a0a12] border border-white/10 rounded-xl max-h-40 overflow-y-auto">
                                        {filteredSkus.length > 0 ? filteredSkus.map(s => (
                                            <button
                                                key={s.sku}
                                                onClick={() => { setFormSku(s.sku); setSkuSearch(''); }}
                                                className="w-full px-4 py-2 text-left hover:bg-blue-500/10 transition-colors border-b border-white/5 last:border-0"
                                            >
                                                <div className="text-xs font-mono text-cyan-300 truncate">{s.sku}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{s.name}</div>
                                            </button>
                                        )) : (
                                            <div className="px-4 py-3 text-xs text-gray-600">No matching SKUs found</div>
                                        )}
                                    </div>
                                )}
                                {formSku && (
                                    <div className="mt-1 text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-3 py-1 rounded-lg inline-block">
                                        ✓ {formSku}
                                    </div>
                                )}
                            </div>

                            {/* Qty & Time row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 block">Quantity *</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formQty}
                                        onChange={e => setFormQty(Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 block">Scheduled Time</label>
                                    <input
                                        type="time"
                                        value={formTime}
                                        onChange={e => setFormTime(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 block">Notes (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Urgent customer order, priority..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
                            <button
                                onClick={() => setShowScheduleModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddTask}
                                disabled={!formMachine || !formSku || formQty <= 0}
                                className="px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <Plus size={14} /> Add Task
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FactoryLiveOS;
