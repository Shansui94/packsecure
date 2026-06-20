
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, Plus, Trash2, Edit2, Search, User, MapPin, QrCode as QrIcon, Printer, X, AlertTriangle, Check, FileText, Image as ImageIcon } from 'lucide-react';
import QRCode from 'react-qr-code';

const LorryManagement: React.FC = () => {
    const [lorries, setLorries] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Odometer Logs & Alerts State
    const [activeTab, setActiveTab] = useState<'fleet' | 'mileage'>('fleet');
    const [mileageLogs, setMileageLogs] = useState<any[]>([]);
    const [mileageAlerts, setMileageAlerts] = useState<any[]>([]);
    const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
    const [resolveNotes, setResolveNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [editingLorry, setEditingLorry] = useState<any>(null);
    const [formData, setFormData] = useState({
        plate_number: '',
        driver_id: '',
        preferred_zone: 'Not Specified',
        status: 'Available',
        max_volume_m3: 36.8098,
        max_weight_kg: 3000
    });

    const handlePrintQR = (lorry: any) => {
        setEditingLorry(lorry);
        setIsQrModalOpen(true);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [lorriesRes, driversRes, logsRes, alertsRes] = await Promise.all([
            supabase.from('lorries').select('*').order('created_at', { ascending: false }),
            supabase.from('users_public').select('*').order('name'),
            supabase.from('lorry_mileage_logs').select('*, lorries(plate_number), driver:driver_id(name, email)').order('created_at', { ascending: false }),
            supabase.from('lorry_mileage_alerts').select('*, lorries(plate_number), driver:driver_id(name, email), resolver:resolved_by(name, email)').order('created_at', { ascending: false })
        ]);

        if (lorriesRes.data) setLorries(lorriesRes.data);
        if (driversRes.data) {
            const filteredDrivers = driversRes.data.filter((u: any) =>
                u.role === 'Driver' ||
                u.email === 'neosonchun@gmail.com' ||
                u.email === 'ericsoobaolin0219@gmail.com' ||
                u.name?.toLowerCase().includes('neoson')
            );
            setDrivers(filteredDrivers);
        }
        if (logsRes.data) setMileageLogs(logsRes.data);
        if (alertsRes.data) setMileageAlerts(alertsRes.data);
        setLoading(false);
    };

    const handleResolveAlert = async (alertId: string) => {
        if (!resolveNotes.trim()) {
            alert("Please enter resolution notes!");
            return;
        }

        setIsResolving(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error("Not authenticated");

            const { error } = await supabase
                .from('lorry_mileage_alerts')
                .update({
                    resolved: true,
                    resolved_by: authUser.id,
                    resolved_notes: resolveNotes.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', alertId);

            if (error) throw error;

            alert("Alert resolved successfully!");
            setResolvingAlertId(null);
            setResolveNotes('');
            fetchData();
        } catch (err: any) {
            alert("Error resolving alert: " + err.message);
        } finally {
            setIsResolving(false);
        }
    };

    const handleOpenModal = (lorry: any = null) => {
        if (lorry) {
            setEditingLorry(lorry);
            setFormData({
                plate_number: lorry.plate_number,
                driver_id: lorry.driver_id || '',
                preferred_zone: lorry.preferred_zone || 'Not Specified',
                status: lorry.status || 'Available',
                max_volume_m3: lorry.max_volume_m3 != null ? Number(lorry.max_volume_m3) : 36.8098,
                max_weight_kg: lorry.max_weight_kg != null ? Number(lorry.max_weight_kg) : 3000
            });
        } else {
            setEditingLorry(null);
            setFormData({
                plate_number: '',
                driver_id: '',
                preferred_zone: 'Not Specified',
                status: 'Available',
                max_volume_m3: 36.8098,
                max_weight_kg: 3000
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedDriver = drivers.find(d => d.id === formData.driver_id);
        const driverName = selectedDriver ? (selectedDriver.name || selectedDriver.email) : null;

        const payload = {
            ...formData,
            driver_id: formData.driver_id || null,
            driver_name: driverName
        };

        try {
            if (editingLorry) {
                const { error } = await supabase.from('lorries').update(payload).eq('id', editingLorry.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('lorries').insert(payload);
                if (error) throw error;
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleDelete = async (id: string, plate: string) => {
        if (!window.confirm(`Delete Lorry ${plate}?`)) return;
        const { error } = await supabase.from('lorries').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchData();
    };

    const filteredLorries = lorries.filter(l =>
        l.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.driver_name && l.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const ZONES = ["Not Specified", "North", "Central", "South", "East", "West"];
    const STATUSES = ["Available", "On-Route", "Maintenance", "Unavailable"];

    return (
        <div className="p-8 bg-[#121215] min-h-screen text-slate-100">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white italic flex items-center gap-3 uppercase tracking-tighter">
                        <Truck className="text-blue-500" />
                        Lorry Fleet Management
                    </h1>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] font-bold tracking-[0.2em]">Manage your delivery vehicles and assignments.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                >
                    <Plus size={18} /> Add New Lorry
                </button>
            </header>

            {/* Tabs */}
            <div className="flex gap-6 mb-8 border-b border-slate-800 pb-px">
                <button
                    onClick={() => setActiveTab('fleet')}
                    className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'fleet' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Truck size={14} />
                        Lorry Fleet
                    </div>
                    {activeTab === 'fleet' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('mileage')}
                    className={`pb-4 px-2 font-black uppercase text-xs tracking-widest transition-all relative ${activeTab === 'mileage' ? 'text-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText size={14} />
                        Odometer Logs & Alerts
                        {mileageAlerts.filter(a => !a.resolved).length > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                {mileageAlerts.filter(a => !a.resolved).length}
                            </span>
                        )}
                    </div>
                    {activeTab === 'mileage' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />}
                </button>
            </div>

            {activeTab === 'fleet' ? (
                <>
                    {/* Filters */}
                    <div className="mb-6 relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search by plate or driver..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-blue-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* List */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {loading ? (
                            <div className="col-span-full text-center py-20 text-slate-500 animate-pulse uppercase font-black tracking-widest">Loading fleet data...</div>
                        ) : filteredLorries.length === 0 ? (
                            <div className="col-span-full text-center py-20 bg-slate-900/30 rounded-[32px] border-2 border-dashed border-slate-800 text-slate-500 uppercase font-black tracking-widest">
                                No lorries found.
                            </div>
                        ) : (
                            filteredLorries.map((lorry) => (
                                <div key={lorry.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 group hover:border-blue-500/50 transition-all relative overflow-hidden">
                                    {/* Status Indicator */}
                                    <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${lorry.status === 'Available' ? 'bg-green-500/10 text-green-500' :
                                        lorry.status === 'On-Route' ? 'bg-blue-500/10 text-blue-500' :
                                            lorry.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-500' :
                                                'bg-red-500/10 text-red-500'
                                        }`}>
                                        {lorry.status}
                                    </div>

                                    <div className="flex items-center gap-4 mb-6 pt-2">
                                        <div className="w-14 h-14 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center text-blue-500">
                                            <Truck size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{lorry.plate_number}</h3>
                                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                                                <MapPin size={10} /> {lorry.preferred_zone}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Primary Driver</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-200">{lorry.driver_name || 'Unassigned'}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Maximum Capacity</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Volume Limit</span>
                                                    <span className="text-sm font-black text-blue-400 font-mono">
                                                        {lorry.max_volume_m3 != null ? Number(lorry.max_volume_m3).toFixed(2) : '36.81'} m³
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 block mt-0.5">
                                                        (~{Math.round((lorry.max_volume_m3 || 36.8098) / 0.4489)} rolls)
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Weight Limit</span>
                                                    <span className="text-sm font-black text-emerald-400 font-mono">
                                                        {lorry.max_weight_kg != null ? Number(lorry.max_weight_kg) : '3000'} kg
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenModal(lorry)}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest"
                                        >
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handlePrintQR(lorry)}
                                            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                                            title="Print QR"
                                        >
                                            <QrIcon size={16} /> QR
                                        </button>
                                        <button
                                            onClick={() => handleDelete(lorry.id, lorry.plate_number)}
                                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Active Alerts Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black uppercase text-white tracking-widest flex items-center gap-2">
                                <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                                Discrepancy Alerts
                            </h2>
                            <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                                {mileageAlerts.filter(a => !a.resolved).length} Active
                            </span>
                        </div>

                        {mileageAlerts.filter(a => !a.resolved).length === 0 ? (
                            <div className="bg-slate-900/30 border border-slate-800/80 rounded-[32px] p-8 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">
                                ✅ No active mileage alerts!
                            </div>
                        ) : (
                            mileageAlerts.filter(a => !a.resolved).map((alertItem) => (
                                <div key={alertItem.id} className="bg-slate-900 border-2 border-red-500/30 rounded-[24px] p-5 space-y-4 shadow-lg shadow-red-950/5 relative overflow-hidden transition-all hover:border-red-500/50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-xl font-black text-white tracking-tighter uppercase">{alertItem.lorries?.plate_number}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                                                Driver: <span className="text-slate-300">{alertItem.driver?.name || alertItem.driver?.email}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-red-500 bg-red-500/10 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                Diff: {alertItem.difference > 0 ? `+${alertItem.difference}` : alertItem.difference} km
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 text-center">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Expected Mileage</p>
                                            <p className="text-md font-bold font-mono text-slate-400 mt-1">{alertItem.expected_mileage} km</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Logged Mileage</p>
                                            <p className="text-md font-bold font-mono text-red-400 mt-1">{alertItem.logged_mileage} km</p>
                                        </div>
                                    </div>

                                    {alertItem.photo_url && (
                                        <div 
                                            onClick={() => setPreviewImageUrl(alertItem.photo_url)}
                                            className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-zoom-in group"
                                        >
                                            <img src={alertItem.photo_url} className="w-full h-full object-cover group-hover:scale-105 transition-all" alt="Odometer" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                <ImageIcon size={20} className="text-white" />
                                            </div>
                                        </div>
                                    )}

                                    {resolvingAlertId === alertItem.id ? (
                                        <div className="space-y-3 pt-2">
                                            <textarea
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:border-blue-500 outline-none resize-none h-20"
                                                placeholder="Enter resolution notes (e.g., Verified with log sheet)..."
                                                value={resolveNotes}
                                                onChange={(e) => setResolveNotes(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setResolvingAlertId(null)}
                                                    className="flex-1 py-2 bg-slate-950 hover:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-800"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleResolveAlert(alertItem.id)}
                                                    disabled={isResolving}
                                                    className="flex-2 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-blue-950/30"
                                                >
                                                    {isResolving ? 'Resolving...' : 'Resolve Alert'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setResolvingAlertId(alertItem.id)}
                                            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <Check size={14} />
                                            Resolve Discrepancy
                                        </button>
                                    )}

                                    <div className="text-[9px] text-slate-500 text-right mt-1">
                                        Raised: {new Date(alertItem.created_at).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Logs History Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black uppercase text-white tracking-widest flex items-center gap-2">
                                <FileText className="text-blue-500" size={20} />
                                Mileage Logs & Resolved Alerts
                            </h2>
                            <span className="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                                {mileageLogs.length} Total Logs
                            </span>
                        </div>

                        {/* Combined Table/Timeline */}
                        <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left align-middle text-slate-400">
                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-950 border-b border-slate-800 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Timestamp</th>
                                            <th className="px-6 py-4">Lorry Plate</th>
                                            <th className="px-6 py-4">Driver</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4 text-center">Mileage</th>
                                            <th className="px-6 py-4 text-center">Photo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {mileageLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-600 font-bold uppercase tracking-widest">
                                                    No mileage logs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            mileageLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-950/35 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-400">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-white font-black uppercase tracking-tighter">
                                                        {log.lorries?.plate_number}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-300">
                                                        {log.driver?.name || log.driver?.email}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${log.log_type === 'start' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                            {log.log_type === 'start' ? 'Start Shift' : 'End Shift'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center font-mono font-bold text-slate-200">
                                                        {log.mileage} km
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {log.photo_url ? (
                                                            <button 
                                                                onClick={() => setPreviewImageUrl(log.photo_url)}
                                                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all inline-block"
                                                            >
                                                                <ImageIcon size={14} />
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Resolved Alerts Section */}
                        {mileageAlerts.filter(a => a.resolved).length > 0 && (
                            <div className="space-y-4 pt-4">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest text-slate-400">Resolved Alerts History</h3>
                                <div className="space-y-3">
                                    {mileageAlerts.filter(a => a.resolved).map((alertItem) => (
                                        <div key={alertItem.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-white uppercase">{alertItem.lorries?.plate_number}</span>
                                                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Resolved</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500">
                                                    Driver: <span className="text-slate-400 font-bold">{alertItem.driver?.name || alertItem.driver?.email}</span> | Expected: {alertItem.expected_mileage}km | Logged: {alertItem.logged_mileage}km (Diff: {alertItem.difference}km)
                                                </p>
                                                <p className="text-[11px] text-emerald-400 font-medium italic mt-1 bg-emerald-500/[0.02] border-l-2 border-emerald-500/30 pl-2">
                                                    Notes: "{alertItem.resolved_notes}" — by {alertItem.resolver?.name || alertItem.resolver?.email}
                                                </p>
                                            </div>
                                            {alertItem.photo_url && (
                                                <button 
                                                    onClick={() => setPreviewImageUrl(alertItem.photo_url)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all self-end md:self-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                    <ImageIcon size={12} /> View Photo
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-[#1a1a1e] border border-slate-800 w-full max-w-lg rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-8 flex items-center gap-3">
                            {editingLorry ? <Edit2 className="text-blue-500" /> : <Plus className="text-blue-500" />}
                            {editingLorry ? 'Edit Lorry' : 'Add New Lorry'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Plate Number</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold tracking-widest uppercase focus:border-blue-500 outline-none"
                                    placeholder="VAA 1234"
                                    value={formData.plate_number}
                                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Zone</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                        value={formData.preferred_zone}
                                        onChange={(e) => setFormData({ ...formData, preferred_zone: e.target.value })}
                                    >
                                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Status</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Max Volume (m³)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.0001"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none font-mono"
                                        placeholder="36.81"
                                        value={formData.max_volume_m3}
                                        onChange={(e) => setFormData({ ...formData, max_volume_m3: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-[9px] text-slate-500 mt-1 block font-medium">
                                        ~{Math.round((formData.max_volume_m3 || 0) / 0.4489)} rolls bubblewrap
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Max Weight (kg)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none font-mono"
                                        placeholder="3000"
                                        value={formData.max_weight_kg}
                                        onChange={(e) => setFormData({ ...formData, max_weight_kg: parseInt(e.target.value, 10) || 0 })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Assigned Driver (Optional)</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none"
                                    value={formData.driver_id}
                                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                                >
                                    <option value="">Unassigned</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name || d.email}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-2 bg-blue-600 hover:bg-blue-500 text-white p-4 px-12 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-900/20"
                                >
                                    {editingLorry ? 'Update Lorry' : 'Save Lorry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Print QR Modal */}
            {isQrModalOpen && editingLorry && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsQrModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
                        {/* Printable Area */}
                        <div id="print-qr-area" className="flex flex-col items-center bg-white p-6 rounded-3xl w-full text-center print-exact">
                            <Truck size={48} className="text-blue-600 mb-2" />
                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">
                                {editingLorry.plate_number}
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-8">Scan to Bind Lorry</p>
                            
                            <div className="bg-white p-4 rounded-3xl border-4 border-slate-900 shadow-xl inline-block mb-8 object-contain">
                                <QRCode 
                                    value={JSON.stringify({ type: 'LorryBind', lorryId: editingLorry.id, plate: editingLorry.plate_number })} 
                                    size={200}
                                    level="H"
                                    fgColor="#0f172a"
                                />
                            </div>
                        </div>

                        {/* Actions (Not Printed) */}
                        <div className="flex gap-4 w-full mt-2 print:hidden">
                            <button
                                onClick={() => setIsQrModalOpen(false)}
                                className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all shrink-0"
                            >
                                <X size={20} />
                            </button>
                            <button
                                onClick={() => {
                                    const printContent = document.getElementById('print-qr-area');
                                    const originalContents = document.body.innerHTML;
                                    if(printContent) {
                                        document.body.innerHTML = printContent.innerHTML;
                                        window.print();
                                        document.body.innerHTML = originalContents;
                                        window.location.reload(); // Reload to restore React bindings after brutal DOM manipulation
                                    }
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                            >
                                <Printer size={18} /> Print Sticker
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImageUrl && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <button 
                        onClick={() => setPreviewImageUrl(null)} 
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={previewImageUrl} 
                        alt="Preview" 
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-4">
                        Click anywhere to close
                    </p>
                </div>
            )}
        </div>
    );
};

export default LorryManagement;
