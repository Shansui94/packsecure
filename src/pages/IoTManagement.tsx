import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
    Cpu,
    Settings,
    RefreshCw,
    Activity
} from 'lucide-react';

interface IoTConfig {
    mac_address: string;
    machine_id: string;
    lane_id: string;  // kept in DB but managed by ProductionControl
    active_product_sku: string;
    count_per_signal: number;
    debounce_ms: number;
    cutting_size: number;
    firmware_version: string;
    last_heartbeat: string | null;
    notes: string;
}

interface Machine {
    machine_id: string;
    name: string;
}

const IoTManagement: React.FC = () => {
    const [configs, setConfigs] = useState<IoTConfig[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingMacs, setEditingMacs] = useState<Set<string>>(new Set());

    const toggleEdit = (mac: string) =>
        setEditingMacs(prev => { const s = new Set(prev); s.has(mac) ? s.delete(mac) : s.add(mac); return s; });

    // Fetch all data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [configRes, machineRes] = await Promise.all([
                supabase.from('iot_device_configs').select('*').order('updated_at', { ascending: false }),
                supabase.from('sys_machines_v2').select('machine_id, name'),
            ]);

            if (configRes.data) setConfigs(configRes.data);
            if (machineRes.data) setMachines(machineRes.data);
        } catch (err) {
            console.error("Error fetching IoT data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Subscribe to real-time updates
        const channel = supabase.channel('iot-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'iot_device_configs' }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleUpdate = async (mac: string, updates: Partial<IoTConfig>) => {
        setSaving(mac);
        try {
            const { error } = await supabase
                .from('iot_device_configs')
                .update({ ...updates, updated_at: new Date() })
                .eq('mac_address', mac);

            if (error) throw error;


            // Local state update
            setConfigs(prev => prev.map(c => c.mac_address === mac ? { ...c, ...updates } : c));
        } catch (err: any) {
            alert("Update failed: " + err.message);
        } finally {
            setSaving(null);
        }
    };

    const getStatus = (lastHeartbeat: string | null) => {
        if (!lastHeartbeat) return 'Offline';
        const diff = Date.now() - new Date(lastHeartbeat).getTime();
        return diff < 300000 ? 'Online' : 'Offline'; // 5 mins threshold
    };

    return (
        <div className="p-6 min-h-screen bg-slate-900 text-white animate-fade-in pb-20">
            <header className="flex justify-between items-center mb-8 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                        <Cpu className="text-blue-500" />
                        IoT Management
                    </h1>
                    <p className="text-gray-400 mt-1">Remote Configuration & Monitoring Hub</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {configs.length === 0 && !loading && (
                    <div className="bg-black/20 border border-white/5 rounded-3xl p-20 text-center">
                        <Activity size={60} className="mx-auto text-gray-700 mb-4" />
                        <h3 className="text-xl font-bold text-gray-500">No IoT Devices Discovered Yet</h3>
                        <p className="text-gray-600 mt-2">Connect an ESP32 to auto-register it here.</p>
                    </div>
                )}

                {configs.map(config => {
                    const status = getStatus(config.last_heartbeat);
                    const isOnline = status === 'Online';
                    const debouncePresets = [
                        { label: '1 min', ms: 60000 },
                        { label: '2 min', ms: 120000 },
                        { label: '4.5 min', ms: 270000 },
                        { label: '6 min', ms: 360000 },
                    ];

                    return (
                        <div key={config.mac_address}
                            className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all duration-300"
                        >
                            {/* ── Header ── */}
                            <div className="px-5 py-3 bg-white/5 border-b border-white/5 flex flex-wrap justify-between items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                                    <span className="font-mono text-sm tracking-widest text-blue-400">{config.mac_address}</span>
                                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400">v{config.firmware_version || '—'}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                        {status.toUpperCase()}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {config.last_heartbeat ? new Date(config.last_heartbeat).toLocaleString() : 'Never'}
                                </span>
                            </div>

                            {/* ── Body: 2-column grid ── */}
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

                                {/* LEFT: Device Binding */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Device Binding</p>
                                        {config.machine_id && (
                                            <button
                                                onClick={() => toggleEdit(config.mac_address)}
                                                className="text-[10px] text-gray-500 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 transition-all"
                                            >
                                                {editingMacs.has(config.mac_address) ? 'Cancel' : 'Change'}
                                            </button>
                                        )}
                                    </div>

                                    {/* CONFIRMED STATE */}
                                    {config.machine_id && !editingMacs.has(config.mac_address) ? (
                                        <div className="space-y-2">
                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
                                                <div>
                                                    <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-1">Bound Machine</div>
                                                    <div className="text-white font-bold text-sm">{config.machine_id}</div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-lg">✓</div>
                                            </div>
                                            {/* Terminal URL — for bookmark / home-screen shortcut */}
                                            <div className="bg-black/30 border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 flex-shrink-0">Terminal URL</span>
                                                <span className="text-[10px] font-mono text-blue-400 truncate flex-1">
                                                    {window.location.origin}/#/production/{config.machine_id}
                                                </span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/production/${config.machine_id}`)}
                                                    className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition-all flex-shrink-0"
                                                    title="Copy URL"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* EDIT STATE */
                                        <>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1.5 block">Binding Machine</label>
                                                <select
                                                    value={config.machine_id || ''}
                                                    onChange={e => {
                                                        handleUpdate(config.mac_address, { machine_id: e.target.value });
                                                        if (e.target.value) toggleEdit(config.mac_address);
                                                    }}
                                                    className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">— Unassigned —</option>
                                                    {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.machine_id} – {m.name}</option>)}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* RIGHT: Signal Config */}
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Signal Config</p>

                                    {/* Debounce Presets */}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1.5 block">
                                            Cycle Cooldown &nbsp;
                                            <span className="text-blue-400 font-semibold">
                                                {(config.debounce_ms / 60000).toFixed(1)} min
                                            </span>
                                        </label>
                                        <div className="flex gap-2">
                                            {debouncePresets.map(({ label, ms }) => (
                                                <button key={ms}
                                                    onClick={() => handleUpdate(config.mac_address, { debounce_ms: ms })}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${config.debounce_ms === ms
                                                        ? 'bg-cyan-600 text-white'
                                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Footer: Notes ── */}
                            <div className="px-5 py-2.5 bg-black/20 border-t border-white/5 flex items-center gap-2">
                                <Settings size={11} className="text-gray-600 flex-shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Device notes..."
                                    value={config.notes || ''}
                                    onBlur={e => handleUpdate(config.mac_address, { notes: e.target.value })}
                                    className="bg-transparent border-none text-[11px] text-gray-500 w-full focus:outline-none italic"
                                />
                                {saving === config.mac_address && <RefreshCw size={12} className="animate-spin text-blue-500 flex-shrink-0" />}
                            </div>
                        </div>
                    );
                })}

            </div>
        </div>
    );
};

export default IoTManagement;
