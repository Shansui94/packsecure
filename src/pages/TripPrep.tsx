import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Camera, ClipboardList, Loader, CheckCircle, Package, RefreshCw, AlertCircle, Truck, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';
import { SalesOrder } from '../types';
import { WAREHOUSES } from '../data/factoryData';
import { parsePrepPhotos, stringifyPrepPhotos, PrepPhoto } from '../utils/prepPhotos';

const getItemLocation = (item: any, order: any): string => {
    if (item.sourceLocation) {
        const src = item.sourceLocation.toLowerCase();
        if (src.includes('opm lama')) return 'OPM Lama';
        if (src.includes('opm corner')) return 'OPM Corner';
        if (src.includes('opm ali')) return 'OPM Ali';
        if (src.includes('nilai')) return 'Nilai';
        if (src.includes('spd')) return 'SPD';
    }
    if (item.remark) {
        const r = item.remark.toLowerCase();
        if (r.includes('opm lama')) return 'OPM Lama';
        if (r.includes('opm corner')) return 'OPM Corner';
        if (r.includes('opm ali')) return 'OPM Ali';
        if (r.includes('nilai')) return 'Nilai';
        if (r.includes('spd')) return 'SPD';
    }
    if (order.trip_origin) {
        const origin = order.trip_origin.toUpperCase();
        if (origin === 'NILAI') return 'Nilai';
        if (origin === 'TAIPING' || origin === 'SPD') return 'SPD';
    }
    return 'SPD';
};

interface DriverInfo {
    id: string;
    name: string;
    email: string;
}

const compressImage = (file: File, maxWidth = 1200, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) {
                    h = (maxWidth / w) * h;
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            if (e.target?.result) {
                img.src = e.target.result as string;
            } else {
                reject(new Error("File conversion failed"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const TripPrep: React.FC = () => {
    const [trips, setTrips] = useState<SalesOrder[]>([]);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [drivers, setDrivers] = useState<Record<string, DriverInfo>>({});
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [activeLocationFilter, setActiveLocationFilter] = useState<'All' | 'Taiping' | 'Nilai'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedTripIdForUpload, setSelectedTripIdForUpload] = useState<string | null>(null);
    const [selectedLocationForUpload, setSelectedLocationForUpload] = useState<string>('General');
    const [expandedTrips, setExpandedTrips] = useState<Record<string, boolean>>({});

    const fetchTripsAndDrivers = async () => {
        setLoading(true);
        try {
            // 1. Fetch all active orders (New, Assigned, Loaded)
            const { data: ordersData, error: ordersError } = await supabase
                .from('sales_orders')
                .select('*')
                .neq('status', 'Cancelled')
                .neq('status', 'Delivered')
                .order('deadline', { ascending: true });

            if (ordersError) throw ordersError;

            // 2. Fetch all drivers for mapping IDs to Names
            const { data: driversData, error: driversError } = await supabase
                .from('users_public')
                .select('id, name, email')
                .eq('role', 'Driver');

            if (driversError) throw driversError;

            const driverMap: Record<string, DriverInfo> = {};
            if (driversData) {
                driversData.forEach((d: any) => {
                    driverMap[d.id] = {
                        id: d.id,
                        name: d.name || d.email?.split('@')[0] || 'Unknown Driver',
                        email: d.email || ''
                    };
                });
            }

            setDrivers(driverMap);

            if (ordersData) {
                // Map snake_case to camelCase mapping for TS consistency if needed
                const mapped: SalesOrder[] = ordersData.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    zone: item.zone || item.delivery_zone,
                    deliveryDate: item.deadline,
                    orderDate: item.order_date || item.orderDate
                }));
                setTrips(mapped);
            }
        } catch (err) {
            console.error("Failed to load prep data:", err);
            alert("Error fetching trips: " + (err instanceof Error ? err.message : String(err)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTripsAndDrivers();
    }, []);

    const toggleTripExpand = (id: string) => {
        setExpandedTrips(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleUploadButtonClick = (tripId: string, location: string) => {
        setSelectedTripIdForUpload(tripId);
        setSelectedLocationForUpload(location);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const tripId = selectedTripIdForUpload;
        const uploadLoc = selectedLocationForUpload;
        if (!file || !tripId) return;

        setUploadingId(tripId);
        try {
            const currentTrip = trips.find(t => t.id === tripId);
            const existingPhotos = parsePrepPhotos(currentTrip?.preparation_photo_url);

            // 1. Compress image to prevent uploading giant photos (> 5MB)
            const compressedDataUrl = await compressImage(file);
            const base64Content = compressedDataUrl.split(',')[1];
            const blob = await fetch(`data:image/jpeg;base64,${base64Content}`).then(r => r.blob());

            const filename = `prep_${tripId}_${Date.now()}.jpg`;

            // 2. Upload to work-photos bucket
            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(filename, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(filename);
            const publicUrl = urlData.publicUrl;

            // Create new photo item and append to existing
            const newPhoto: PrepPhoto = { url: publicUrl, location: uploadLoc };
            const updatedPhotos = [...existingPhotos, newPhoto];
            const updatedPhotoUrlField = stringifyPrepPhotos(updatedPhotos);

            // 4. Update sales_orders preparation_photo_url field
            const { error: updateError } = await supabase
                .from('sales_orders')
                .update({ preparation_photo_url: updatedPhotoUrlField })
                .eq('id', tripId);

            if (updateError) throw updateError;

            // Update local state optimistically
            setTrips(prev => prev.map(t => t.id === tripId ? { ...t, preparation_photo_url: updatedPhotoUrlField } as any : t));
            
            // Highlight success
            alert(`✅ ${uploadLoc} 备货图片上传成功！ / Cargo photo uploaded successfully!`);
        } catch (err: any) {
            console.error("Failed to upload photo:", err);
            alert("Upload failed: " + err.message);
        } finally {
            setUploadingId(null);
            setSelectedTripIdForUpload(null);
            setSelectedLocationForUpload('General');
        }
    };

    const handleDeletePhoto = async (tripId: string, photoIndex: number) => {
        if (!window.confirm("确定要删除这张备货照片吗？ / Are you sure you want to delete this photo?")) return;
        
        try {
            const currentTrip = trips.find(t => t.id === tripId);
            if (!currentTrip) return;
            const existingPhotos = parsePrepPhotos(currentTrip.preparation_photo_url);
            
            const updatedPhotos = existingPhotos.filter((_, idx) => idx !== photoIndex);
            const updatedPhotoUrlField = updatedPhotos.length > 0 ? stringifyPrepPhotos(updatedPhotos) : null;
            
            const { error } = await supabase
                .from('sales_orders')
                .update({ preparation_photo_url: updatedPhotoUrlField })
                .eq('id', tripId);
                
            if (error) throw error;
            
            setTrips(prev => prev.map(t => t.id === tripId ? { ...t, preparation_photo_url: updatedPhotoUrlField } as any : t));
            alert("✅ 照片已成功删除！ / Photo deleted successfully!");
        } catch (err: any) {
            console.error("Failed to delete photo:", err);
            alert("Delete failed: " + err.message);
        }
    };

    // Filters
    const filteredTrips = trips.filter(t => {
        // Location filter (Taiping vs Nilai)
        let location = 'Taiping';
        if (t.trip_origin) {
            location = t.trip_origin.toLowerCase() === 'nilai' ? 'Nilai' : 'Taiping';
        } else if (t.deliveryAddress) {
            // heuristic
            const addr = t.deliveryAddress.toLowerCase();
            if (addr.includes('nilai') || addr.includes('kl') || addr.includes('selangor') || addr.includes('kuala lumpur')) {
                location = 'Nilai';
            }
        }
        
        const matchesLocation = activeLocationFilter === 'All' || location.toLowerCase() === activeLocationFilter.toLowerCase();

        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const driverName = t.driver_id ? (drivers[t.driver_id]?.name || '') : 'Unassigned';
        const matchesSearch = !searchQuery || 
            t.orderNumber?.toLowerCase().includes(searchLower) ||
            t.deliveryAddress?.toLowerCase().includes(searchLower) ||
            t.zone?.toLowerCase().includes(searchLower) ||
            driverName.toLowerCase().includes(searchLower) ||
            t.items?.some(i => (i.product || i.sku || '').toLowerCase().includes(searchLower));

        return matchesLocation && matchesSearch;
    });

    const formatShortDate = (dateStr?: string) => {
        if (!dateStr) return 'No Date';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const getDayName = (dateStr?: string) => {
        if (!dateStr) return '';
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date(dateStr).getDay()];
    };

    return (
        <div className="p-4 md:p-6 bg-[#07070a] min-h-screen text-white font-sans selection:bg-blue-500/30">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 mb-1">
                        <Camera className="text-amber-500" size={28} /> Cargo Trip Prep (备货拍照)
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm">Prepare items for active trips and upload photos to guide drivers.</p>
                </div>
                <button 
                    onClick={fetchTripsAndDrivers} 
                    disabled={loading}
                    className="self-start px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Filter bar */}
            <div className="mb-6 flex flex-col md:flex-row gap-3">
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search trip no, address, driver or items..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                
                <div className="flex gap-1.5 bg-[#0d0d12] p-1 border border-white/5 rounded-xl self-start">
                    {(['All', 'Taiping', 'Nilai'] as const).map(loc => (
                        <button
                            key={loc}
                            onClick={() => setActiveLocationFilter(loc)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeLocationFilter === loc 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                    : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {loc}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-500">
                    <Loader className="animate-spin text-amber-500" size={32} />
                    <p className="text-sm font-medium animate-pulse">Loading active trips...</p>
                </div>
            ) : filteredTrips.length === 0 ? (
                <div className="text-center py-20 text-gray-600 border-2 border-dashed border-white/5 rounded-2xl bg-[#0d0d12]/30">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-30 text-zinc-500" />
                    <p className="font-bold">No active trips found.</p>
                    <p className="text-xs text-gray-500 mt-1">Try changing filters or wait for admins to create trips.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredTrips.map(trip => {
                        const isExpanded = expandedTrips[trip.id] ?? true;
                        const isUploaded = !!trip.preparation_photo_url;
                        const assignedDriver = trip.driver_id ? (drivers[trip.driver_id]?.name || 'Driver') : 'Unassigned';
                        const tripLocation = trip.trip_origin || 'Taiping';

                        return (
                            <div key={trip.id} className="bg-[#0d0d12] border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:border-white/10 transition-all flex flex-col">
                                {/* Header Card */}
                                <div className="p-4 border-b border-white/5 flex items-start justify-between gap-3 bg-white/[0.01]">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <span className="text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/10">
                                                {tripLocation}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                                                trip.status === 'New' || (trip.status as string) === 'Assigned'
                                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            }`}>
                                                {trip.status}
                                            </span>
                                            {isUploaded && (
                                                <span className="text-[9px] font-black uppercase bg-green-500/15 border border-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <CheckCircle size={8} /> Prepared (已备货)
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="font-bold text-sm text-slate-400 tracking-wider">
                                            {trip.orderNumber || 'Trip'}
                                        </h2>
                                        <h3 className="font-black text-white text-base truncate mt-0.5" title={trip.deliveryAddress || trip.zone}>
                                            {trip.deliveryAddress || trip.zone || 'No Destinations'}
                                        </h3>
                                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-bold mt-1 uppercase">
                                            <span className="text-zinc-400">{getDayName(trip.deliveryDate)} {formatShortDate(trip.deliveryDate)}</span>
                                            <span className="flex items-center gap-1 text-blue-400">
                                                <Truck size={10} /> {assignedDriver}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => toggleTripExpand(trip.id)} 
                                        className="p-1 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all self-center"
                                    >
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 flex-1 flex flex-col gap-4">
                                        {/* Products List */}
                                        <div className="space-y-2 flex-1">
                                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                                                <Package size={10} /> Prepared Products List / 待备货清单
                                            </p>
                                            <div className="bg-black/35 rounded-xl border border-white/5 p-3 space-y-2">
                                                {(trip.items || []).map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start text-xs border-b border-white/[0.03] last:border-0 pb-2.5 last:pb-0 pt-1.5 first:pt-0">
                                                        <div className="min-w-0 pr-2 flex-1">
                                                            <p className="font-bold text-white">{item.product || item.sku}</p>
                                                            {item.remark && (
                                                                <p className="text-xs text-amber-500 font-mono tracking-wide mt-1 whitespace-pre-wrap bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/10 w-fit max-w-full">
                                                                    Remark: {item.remark}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="shrink-0 text-right font-mono font-black text-blue-400 pl-2">
                                                            {item.quantity} Unit(s)
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Cargo Prep Photo Upload Section */}
                                        {(() => {
                                            const photos = parsePrepPhotos(trip.preparation_photo_url);
                                            return (
                                                <div className="mt-2 pt-4 border-t border-white/5 space-y-4">
                                                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                                                        <Camera size={10} className="text-amber-500" /> Cargo Photos / 备货照片
                                                    </p>
                                                    
                                                    {photos.length > 0 ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                            {photos.map((p, idx) => (
                                                                <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex flex-col justify-end cursor-zoom-in" onClick={() => setPreviewImageUrl(p.url)}>
                                                                    <img 
                                                                        src={p.url} 
                                                                        alt={`Cargo Prep - ${p.location}`} 
                                                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                    />
                                                                    {/* Location label overlay */}
                                                                    <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-sm text-[9px] font-black text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                                                                        {p.location}
                                                                    </div>
                                                                    {/* Delete button overlay */}
                                                                    <button
                                                                        onClick={() => handleDeletePhoto(trip.id, idx)}
                                                                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                                                                        title="Delete Photo"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="w-full py-6 rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-600 bg-black/20">
                                                            <AlertCircle size={24} className="opacity-30 mb-1" />
                                                            <span className="text-[9px] uppercase font-bold tracking-widest">No Cargo Photos Uploaded / 暂无备货照片</span>
                                                        </div>
                                                    )}

                                                    {/* Upload triggers */}
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                                            📷 Upload Photo by Warehouse / 按仓库拍照上传:
                                                        </p>
                                                        
                                                        <div className="flex flex-wrap gap-2">
                                                            {(() => {
                                                                const itemLocs = Array.from(new Set(
                                                                    (trip.items || []).map(item => getItemLocation(item, trip))
                                                                ));
                                                                
                                                                const allButtons = Array.from(new Set([...itemLocs, ...WAREHOUSES]));

                                                                return allButtons.map(loc => {
                                                                    const isRelevant = itemLocs.includes(loc);
                                                                    const isCurrentlyUploading = uploadingId === trip.id && selectedLocationForUpload === loc;
                                                                    return (
                                                                        <button
                                                                            key={loc}
                                                                            onClick={() => handleUploadButtonClick(trip.id, loc)}
                                                                            disabled={uploadingId === trip.id}
                                                                            className={`px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                                                                isRelevant
                                                                                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/20'
                                                                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                                                                            } disabled:opacity-50`}
                                                                        >
                                                                            {isCurrentlyUploading ? (
                                                                                <Loader size={12} className="animate-spin" />
                                                                            ) : (
                                                                                <Camera size={12} />
                                                                            )}
                                                                            {loc}
                                                                        </button>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Hidden native input for mobile photo capture */}
            <input 
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
            />

            {/* Full Screen Image Preview Modal */}
            {previewImageUrl && (
                <div 
                    className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
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
                        Ketik di mana-mana untuk tutup / Tap anywhere to close
                    </p>
                </div>
            )}
        </div>
    );
};

export default TripPrep;
