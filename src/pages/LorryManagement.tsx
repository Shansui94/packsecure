
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Truck, Plus, Trash2, Edit2, Search, User, MapPin, QrCode as QrIcon, Printer, X } from 'lucide-react';
import QRCode from 'react-qr-code';

const LorryManagement: React.FC = () => {
    const [lorries, setLorries] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [editingLorry, setEditingLorry] = useState<any>(null);
    const [formData, setFormData] = useState({
        plate_number: '',
        driver_id: '',
        preferred_zone: 'Not Specified',
        status: 'Available'
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
        const [lorriesRes, driversRes] = await Promise.all([
            supabase.from('lorries').select('*').order('created_at', { ascending: false }),
            supabase.from('users_public').select('*').order('name')
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
        setLoading(false);
    };

    const handleOpenModal = (lorry: any = null) => {
        if (lorry) {
            setEditingLorry(lorry);
            setFormData({
                plate_number: lorry.plate_number,
                driver_id: lorry.driver_id || '',
                preferred_zone: lorry.preferred_zone || 'Not Specified',
                status: lorry.status || 'Available'
            });
        } else {
            setEditingLorry(null);
            setFormData({
                plate_number: '',
                driver_id: '',
                preferred_zone: 'Not Specified',
                status: 'Available'
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
        </div>
    );
};

export default LorryManagement;
