import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Activity, Cpu, Zap, AlertTriangle, X, Box, Wifi, WifiOff, ChevronRight, RefreshCw } from 'lucide-react';

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
    id: string;
    created_at: string;
    machine_id: string;
    product_sku: string | null;
    alarm_count: number;
    lane_id?: string;
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
        supabase.from('production_logs')
            .select('id, created_at, machine_id, product_sku, alarm_count, lane_id')
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
                                <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-white/2">
                                    <div>
                                        <div className="text-xs text-gray-400 font-mono">
                                            {new Date(log.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        {log.product_sku && (
                                            <div className="text-[10px] text-gray-600 font-mono mt-0.5">{log.product_sku}</div>
                                        )}
                                        {/* Show Lane unless it's Unknown */}
                                        {log.lane_id && log.lane_id !== 'Unknown' && (
                                            <div className="text-[9px] text-gray-700 font-mono mt-0.5 uppercase">LANE: {log.lane_id}</div>
                                        )}
                                    </div>
                                    <div className={`text-sm font-black ${log.alarm_count === 0 ? 'text-orange-400' : 'text-white'}`}>
                                        {log.alarm_count === 0 ? '⚡ REBOOT' : `+${(
                                            (log.lane_id === 'Unknown' && (log.machine_id.startsWith('N1') || log.machine_id.startsWith('N2') || log.machine_id === 'T1.2-M01')) ||
                                            (log.machine_id === 'T1.3-M02' && log.alarm_count === 2)
                                        ) ? 1 : log.alarm_count}`}
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

const FactoryLiveOS = () => {
    const [machines, setMachines] = useState<MachineCard[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<MachineCard | null>(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [clock, setClock] = useState(new Date());

    // Clock tick
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const loadData = useCallback(async () => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const [machinesRes, iotRes, logsRes, activeRes] = await Promise.all([
            supabase.from('sys_machines_v2').select('machine_id, name, factory_id, base_width, type').order('factory_id'),
            supabase.from('iot_device_configs').select('mac_address, machine_id, last_heartbeat'),
            supabase.from('production_logs').select('machine_id, alarm_count, created_at, product_sku, lane_id').gte('created_at', todayISO),
            supabase.from('machine_active_products').select('machine_id, product_sku'),
        ]);

        const iotMap: Record<string, { last_heartbeat: string; mac: string }> = {};
        (iotRes.data || []).forEach((d: any) => {
            iotMap[d.machine_id] = { last_heartbeat: d.last_heartbeat, mac: d.mac_address };
        });

        const activeMap: Record<string, string> = {};
        (activeRes.data || []).forEach((d: any) => { if (d.product_sku) activeMap[d.machine_id] = d.product_sku; });

        // Aggregate logs
        const countMap: Record<string, number> = {};
        const lastProdMap: Record<string, string> = {};
        const rebootMap: Record<string, number> = {};
        const gapMap: Record<string, { start: string, end: string, duration_min: number }[]> = {};
        const lastTimeMap: Record<string, number> = {};

        (logsRes.data || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .forEach((log: any) => {
                const id = log.machine_id;
                const t = new Date(log.created_at).getTime();

                // Patch for old firmware inserting +2
                let count = log.alarm_count;
                if (count === 2) {
                    if (log.lane_id === 'Unknown' && (id.startsWith('N1') || id.startsWith('N2') || id === 'T1.2-M01')) count = 1;
                    if (id === 'T1.3-M02') count = 1;
                }

                if (count > 0) countMap[id] = (countMap[id] || 0) + count;
                else rebootMap[id] = (rebootMap[id] || 0) + 1;

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
                if (!lastProdMap[id] || t > new Date(lastProdMap[id]).getTime()) lastProdMap[id] = log.created_at;
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
        setLastUpdate(new Date());
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadData, 30000);

        // Realtime: new production log → refresh
        const channel = supabase.channel('factory-live-os')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_logs' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_device_configs' }, loadData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_active_products' }, loadData)
            .subscribe();

        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [loadData]);

    const onlineCount = machines.filter(m => m.status === 'Online').length;
    const producingCount = machines.filter(m => m.isProducing).length;
    const totalRolls = machines.reduce((s, m) => s + m.today_count, 0);
    const alertCount = machines.reduce((s, m) => s + m.reboot_count, 0);

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

            {/* ── SUMMARY BAR ── */}
            <div className="border-b border-white/5 bg-black/20 px-6 py-3 grid grid-cols-4 gap-4">
                {[
                    { label: 'Online', value: onlineCount, icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { label: 'Producing', value: producingCount, icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Total Rolls Today', value: totalRolls.toLocaleString(), icon: Box, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
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

            {/* ── MACHINE GRID ── */}
            <main className="flex-1 p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-gray-500 text-sm font-mono">Loading machines…</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        {machines.map(m => (
                            <MachineCardView key={m.machine_id} machine={m} onClick={() => setSelectedMachine(m)} />
                        ))}
                    </div>
                )}

                {/* Factory divider by location */}
                {!loading && machines.length > 0 && (
                    <div className="mt-6 text-center text-[10px] text-gray-700 font-mono uppercase tracking-widest">
                        ── {machines.filter(m => m.factory_id === 'N1' || m.factory_id === 'N2').length} Nilai · {machines.filter(m => m.factory_id === 'T1').length} Taiping ──
                    </div>
                )}
            </main>

            {/* ── DETAIL PANEL ── */}
            {selectedMachine && (
                <DetailPanel machine={selectedMachine} onClose={() => setSelectedMachine(null)} />
            )}
        </div>
    );
};

export default FactoryLiveOS;
