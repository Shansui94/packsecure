import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Calendar, Package, X, CheckCircle, Clock, Upload, Camera, RefreshCw } from 'lucide-react';
import { SalesOrder } from '../types';
import { compressImage, watermarkImage, dataURLtoBlob } from '../utils/imageCompress';
import { logActivity } from '../utils/logger';

interface DriverHistoryProps {
    user: any;
}

const DriverHistory: React.FC<DriverHistoryProps> = ({ user }) => {
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

    // Later DO Upload State
    const [laterUploadTarget, setLaterUploadTarget] = useState<{ orderId: string; photoIndex: number } | null>(null);
    const [laterUploading, setLaterUploading] = useState(false);
    const laterFileInputRef = useRef<HTMLInputElement>(null);

    // Add Drop Modal State
    const [isAddDropModalOpen, setIsAddDropModalOpen] = useState(false);
    const [selectedOrderForDrop, setSelectedOrderForDrop] = useState<any | null>(null);
    const [addDoPhotoBase64, setAddDoPhotoBase64] = useState<string | null>(null);
    const [addProductPhotoBase64, setAddProductPhotoBase64] = useState<string | null>(null);
    const [uploadingDropTarget, setUploadingDropTarget] = useState<'do' | 'product' | null>(null);
    const [addDeliveryNote, setAddDeliveryNote] = useState('');
    const [submittingDrop, setSubmittingDrop] = useState(false);
    const [gpsCoordinates, setGpsCoordinates] = useState('Fetching GPS...');
    const [fetchingGps, setFetchingGps] = useState(false);

    const addCameraDoInputRef = useRef<HTMLInputElement>(null);
    const addGalleryDoInputRef = useRef<HTMLInputElement>(null);
    const addCameraProdInputRef = useRef<HTMLInputElement>(null);
    const addGalleryProdInputRef = useRef<HTMLInputElement>(null);

    const triggerGpsFetch = () => {
        setFetchingGps(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsCoordinates(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
                    setFetchingGps(false);
                },
                (error) => {
                    console.warn("GPS Error:", error);
                    setGpsCoordinates('GPS Unavailable');
                    setFetchingGps(false);
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        } else {
            setGpsCoordinates('GPS Not Supported');
            setFetchingGps(false);
        }
    };

    const extractDoNumberFromAi = async (base64Str: string): Promise<string> => {
        try {
            const response = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Str, mode: 'do' })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.do_number || '';
        } catch (err) {
            console.warn("AI DO extraction failed:", err);
            return '';
        }
    };

    // Fetch History
    const fetchHistory = async () => {
        setLoading(true);
        if (!user?.uid) return;

        try {
            const query = supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', user.uid)
                .in('status', ['Delivered', 'Pending Approval'])
                .order('deadline', { ascending: false });

            const { data } = await query;

            if (data) {
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    deliveryDate: item.deadline,
                    orderDate: item.order_date || item.orderDate,
                }));

                // Client-side date filtering to handle different date representations safely
                const filtered = selectedDate
                    ? mapped.filter((item: any) => {
                          const dateVal = item.deliveryDate || item.orderDate || item.created_at || '';
                          return dateVal.startsWith(selectedDate);
                      })
                    : mapped;

                setTasks(filtered);
            }
        } catch (e) {
            console.error('Error fetching driver history:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerLaterUpload = (orderId: string, idx: number) => {
        setLaterUploadTarget({ orderId, photoIndex: idx });
        laterFileInputRef.current?.click();
    };

    const handleLaterFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !laterUploadTarget) return;

        setLaterUploading(true);
        try {
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];
            const targetOrder = tasks.find(t => t.id === laterUploadTarget.orderId);
            if (!targetOrder) throw new Error("Order not found");

            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const lines = [
                `SO: ${targetOrder.orderNumber || ''} | Plate: Driver History`,
                `Time: ${timeStr} | Type: DO PROOF (HISTORY) / BUKTI DO`,
                `Location: History Upload`
            ];
            const watermarkedBase64 = await watermarkImage(base64Only, lines);

            let extractedDoNumber = '';
            try {
                extractedDoNumber = await extractDoNumberFromAi(watermarkedBase64);
            } catch (err) {
                console.warn("AI DO extraction error:", err);
            }

            const fileName = `unload_do_later_${targetOrder.orderNumber}_${Date.now()}.jpg`;
            const blob = dataURLtoBlob(`data:image/jpeg;base64,${watermarkedBase64}`);
            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            const { data: freshOrder, error: fetchErr } = await supabase
                .from('sales_orders')
                .select('status, trip_drop_count, pod_photo_url, notes')
                .eq('id', laterUploadTarget.orderId)
                .single();

            if (fetchErr) throw fetchErr;

            const currentPhotos = freshOrder.pod_photo_url ? freshOrder.pod_photo_url.split(',') : [];
            while (currentPhotos.length <= laterUploadTarget.photoIndex) {
                currentPhotos.push('');
            }
            currentPhotos[laterUploadTarget.photoIndex] = publicUrl;
            const updatedPodUrl = currentPhotos.join(',');

            const totalDrops = freshOrder.trip_drop_count || 1;
            const filledDoCount = currentPhotos.filter((url, idx) => idx % 2 === 0 && Boolean(url.trim())).length;
            const completedDrops = Math.floor(currentPhotos.filter(Boolean).length / 2);

            let updatedNotes = freshOrder.notes || '';
            if (extractedDoNumber) {
                const cleanNotes = (freshOrder.notes || '').replace(/\[AI DO:\s*.*?\]/g, '').trim();
                updatedNotes = cleanNotes 
                    ? `${cleanNotes}\n[AI DO: ${extractedDoNumber}]`
                    : `[AI DO: ${extractedDoNumber}]`;
            }

            if ((completedDrops >= totalDrops || filledDoCount >= totalDrops) && updatedNotes.includes('Hantaran Separa')) {
                updatedNotes += `\n[${timeStr}] ✅ DO tertunggak telah dimuat naik. Semua ${totalDrops} drops lengkap.`;
            }

            const updatePayload: any = {
                pod_photo_url: updatedPodUrl,
                notes: updatedNotes
            };

            const { error: updateErr } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', laterUploadTarget.orderId);

            if (updateErr) throw updateErr;

            alert("✅ Gambar DO berjaya dimuat naik! / DO Photo successfully uploaded!");
            fetchHistory();
        } catch (err: any) {
            alert("Gagal memuat naik gambar DO: " + err.message);
        } finally {
            setLaterUploading(false);
            setLaterUploadTarget(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleAddDropPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, target: 'do' | 'product') => {
        const file = e.target.files?.[0];
        if (!file || !selectedOrderForDrop) return;

        try {
            setUploadingDropTarget(target);
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];

            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const typeLabel = target === 'do' ? 'DO PROOF / BUKTI DO' : 'CARGO PROOF / BUKTI BARANG';
            const lines = [
                `SO: ${selectedOrderForDrop.orderNumber || ''} | Plate: History POD`,
                `Time: ${timeStr} | Type: ${typeLabel}`,
                `Location: ${gpsCoordinates}`
            ];

            const watermarkedBase64 = await watermarkImage(base64Only, lines);
            if (target === 'do') {
                setAddDoPhotoBase64(watermarkedBase64);
            } else {
                setAddProductPhotoBase64(watermarkedBase64);
            }
        } catch (err: any) {
            alert('Gagal memproses gambar: ' + err.message);
        } finally {
            setUploadingDropTarget(null);
            if (e.target) e.target.value = '';
        }
    };

    const handleConfirmAddDrop = async () => {
        if (!selectedOrderForDrop) return;
        if (!addProductPhotoBase64 && !addDoPhotoBase64) {
            alert("⚠️ Sila ambil sekurang-kurangnya satu gambar (DO atau Barang)!");
            return;
        }

        setSubmittingDrop(true);
        try {
            let doUrl = '';
            let prodUrl = '';
            let extractedDoNumber = '';

            if (addDoPhotoBase64) {
                try {
                    extractedDoNumber = await extractDoNumberFromAi(addDoPhotoBase64);
                } catch (err) {
                    console.warn("AI DO extraction error:", err);
                }

                const doFileName = `unload_do_${selectedOrderForDrop.orderNumber}_${Date.now()}.jpg`;
                const doBlob = dataURLtoBlob(`data:image/jpeg;base64,${addDoPhotoBase64}`);
                const { error: doErr } = await supabase.storage
                    .from('work-photos')
                    .upload(doFileName, doBlob, { contentType: 'image/jpeg' });
                if (doErr) throw doErr;
                const { data: doData } = supabase.storage.from('work-photos').getPublicUrl(doFileName);
                doUrl = doData.publicUrl;
            }

            if (addProductPhotoBase64) {
                const prodFileName = `unload_prod_${selectedOrderForDrop.orderNumber}_${Date.now()}.jpg`;
                const prodBlob = dataURLtoBlob(`data:image/jpeg;base64,${addProductPhotoBase64}`);
                const { error: prodErr } = await supabase.storage
                    .from('work-photos')
                    .upload(prodFileName, prodBlob, { contentType: 'image/jpeg' });
                if (prodErr) throw prodErr;
                const { data: prodData } = supabase.storage.from('work-photos').getPublicUrl(prodFileName);
                prodUrl = prodData.publicUrl;
            }

            const rawPod = selectedOrderForDrop.pod_photo_url ? selectedOrderForDrop.pod_photo_url.trim() : '';
            const existingPhotos = rawPod ? rawPod.split(',') : [];
            const newPhotos = [...existingPhotos, doUrl || '', prodUrl || ''];
            const updatedPodUrl = newPhotos.join(',');

            const totalDrops = selectedOrderForDrop.trip_drop_count || 1;
            const completedDrops = Math.floor(newPhotos.filter(Boolean).length / 2);
            let updatedTripDropCount = totalDrops;
            if (completedDrops > totalDrops) {
                updatedTripDropCount = completedDrops;
            }

            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            const noteSegment = addDeliveryNote.trim() 
                ? `[${timeStr}] ${addDeliveryNote.trim()}`
                : `[${timeStr}] Proof uploaded`;

            let updatedNotes = selectedOrderForDrop.notes ? `${selectedOrderForDrop.notes}\n${noteSegment}` : noteSegment;
            if (extractedDoNumber) {
                const cleanNotes = updatedNotes.replace(/\[AI DO:\s*.*?\]/g, '').trim();
                updatedNotes = cleanNotes ? `${cleanNotes}\n[AI DO: ${extractedDoNumber}]` : `[AI DO: ${extractedDoNumber}]`;
            }

            if (completedDrops >= totalDrops && updatedNotes.includes('Hantaran Separa')) {
                updatedNotes += `\n[${timeStr}] ✅ Drop tambahan dimuat naik (${completedDrops}/${totalDrops} drops lengkap).`;
            }
            if (completedDrops > totalDrops) {
                updatedNotes += `\n[${timeStr}] ℹ️ Jumlah Drop dikemaskini dari ${totalDrops} ke ${completedDrops}.`;
            }

            const updatePayload: any = {
                pod_photo_url: updatedPodUrl,
                pod_timestamp: new Date().toISOString(),
                notes: updatedNotes
            };
            if (completedDrops > totalDrops) {
                updatePayload.trip_drop_count = completedDrops;
            }

            const { error: updateErr } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', selectedOrderForDrop.id);

            if (updateErr) throw updateErr;

            logActivity(user, {
                action: 'DRIVER_APPEND_DROP_PHOTO',
                module: 'Logistics / DriverHistory',
                target: `Order #${selectedOrderForDrop.orderNumber}`,
                status: 'SUCCESS',
                resultSummary: `司机在历史记录补交送货单据与照片 (#${selectedOrderForDrop.orderNumber})`,
                details: {
                    orderId: selectedOrderForDrop.id,
                    orderNumber: selectedOrderForDrop.orderNumber,
                    doUrl,
                    prodUrl,
                    extractedDoNumber: extractedDoNumber || null
                }
            });

            alert("✅ Drop berjaya ditambah! / Drop successfully added!");
            setIsAddDropModalOpen(false);
            setSelectedOrderForDrop(null);
            setAddDoPhotoBase64(null);
            setAddProductPhotoBase64(null);
            setAddDeliveryNote('');
            fetchHistory();
        } catch (err: any) {
            alert("Ralat menambah drop: " + err.message);
        } finally {
            setSubmittingDrop(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user, selectedDate]);

    return (
        <div className="min-h-screen bg-black text-slate-200 pb-24 font-sans">
            {/* TOP BAR */}
            <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black text-white italic tracking-tighter">SEJARAH SAYA / MY HISTORY</h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {user?.name || 'Pemandu'} • {tasks.length} Penghantaran Selesai
                    </p>
                </div>
            </div>

            {/* FILTERS */}
            <div className="p-4 bg-slate-900/50 border-b border-white/5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                    Tapis mengikut Tarikh / Filter by Date
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="date"
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate('')}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-xs font-bold uppercase transition-colors"
                        >
                            Set Semula / Reset
                        </button>
                    )}
                </div>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-500 animate-pulse font-bold">
                        Memuatkan Sejarah... / Loading History...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-16 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={44} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-400 text-sm">Tiada rekod sejarah ditemui. / No history found.</h3>
                        <p className="text-xs text-slate-600 mt-1">Sila tukar tapisan tarikh untuk melihat rekod lain.</p>
                    </div>
                ) : (
                    tasks.map((order) => {
                        const orderTotalDrops = (order as any).trip_drop_count || 1;
                        const rawPodStr = order.pod_photo_url ? order.pod_photo_url.trim() : '';
                        const rawPhotosList = rawPodStr ? rawPodStr.split(',') : [];
                        const completedDropsCount = Math.floor(rawPhotosList.filter(Boolean).length / 2);
                        const validDoPhotosCount = rawPhotosList.filter((url, idx) => idx % 2 === 0 && Boolean(url.trim())).length;
                        const hasMissingDoSlot = rawPhotosList.some((url, idx) => idx % 2 === 0 && !url.trim());
                        const isDropMismatch = (completedDropsCount !== orderTotalDrops) || (validDoPhotosCount !== orderTotalDrops) || hasMissingDoSlot;
                        const extraJobPhoto = (order as any).proof_of_load_url || (order as any).proofOfLoadUrl;

                        return (
                            <div
                                key={order.id}
                                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-5 relative group"
                            >
                                {/* Status Pill */}
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <span className="text-[10px] font-mono font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                                                {order.orderNumber}
                                            </span>
                                            {order.zone && (
                                                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded uppercase">
                                                    {order.zone}
                                                </span>
                                            )}
                                            {orderTotalDrops > 1 && (
                                                <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    {orderTotalDrops} Hentian / Drops
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-base font-black text-white leading-tight">
                                            {order.deliveryAddress || order.customer || 'Tiada Alamat'}
                                        </h2>
                                        {order.customer && order.deliveryAddress && (
                                            <p className="text-xs text-slate-400 font-bold mt-0.5">{order.customer}</p>
                                        )}
                                    </div>
                                    {order.status === 'Pending Approval' ? (
                                        <span className="text-[10px] font-mono font-black bg-yellow-950/60 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                            🟡 PENDING APPROVAL
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-mono font-black bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                            <CheckCircle size={12} /> SELESAI
                                        </span>
                                    )}
                                </div>

                                {/* Drop / DO Mismatch Alert */}
                                {isDropMismatch && (
                                    <div className="mb-3 bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 flex items-start gap-2 text-xs">
                                        <div className="text-amber-400 font-black text-sm shrink-0">⚠️</div>
                                        <div className="flex-1">
                                            <div className="font-black text-amber-400 uppercase flex items-center justify-between flex-wrap gap-1">
                                                <span>Drop & DO Tidak Padan / Mismatch</span>
                                                <span className="font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30">
                                                    {completedDropsCount}/{orderTotalDrops} Drops ({validDoPhotosCount} DO)
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-amber-200/80 mt-0.5 leading-snug">
                                                {completedDropsCount < orderTotalDrops
                                                    ? `Perlu ${orderTotalDrops - completedDropsCount} lagi Drop untuk disahkan.`
                                                    : hasMissingDoSlot
                                                        ? 'Terdapat Drop yang belum mempunyai gambar DO bertandatangan.'
                                                        : `Dihantar ${completedDropsCount} Drops melebihi rekod asal (${orderTotalDrops} Drops).`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Items List summary if available */}
                                {order.items && order.items.length > 0 && (
                                    <div className="mb-3 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-1 flex items-center gap-1">
                                            <Package size={10} /> Senarai Barang / Items
                                        </p>
                                        <div className="space-y-1">
                                            {order.items.map((it: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-slate-300">
                                                    <span>{it.product || it.name || it.sku}</span>
                                                    <span className="font-mono text-white font-bold">{it.quantity} Unit</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* POD Photos Grid */}
                                {(rawPhotosList.length > 0 || isDropMismatch) && (
                                    <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] text-emerald-400 font-black uppercase flex items-center gap-1">
                                                📸 Bukti Penghantaran / Proof of Delivery (POD)
                                            </p>
                                            <span className="text-[10px] font-mono font-bold text-slate-400">
                                                {completedDropsCount} / {orderTotalDrops} Drops
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {rawPhotosList.map((url, idx) => {
                                                const isDo = idx % 2 === 0;
                                                if (!url || !url.trim()) {
                                                    if (isDo) {
                                                        const isUploadingThis = laterUploading && 
                                                            laterUploadTarget?.orderId === order.id && 
                                                            laterUploadTarget?.photoIndex === idx;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!isUploadingThis) handleTriggerLaterUpload(order.id, idx);
                                                                }}
                                                                className="relative rounded-lg border border-dashed border-amber-500/50 bg-amber-950/30 hover:bg-amber-900/40 aspect-square flex flex-col items-center justify-center p-1 cursor-pointer group transition-all"
                                                            >
                                                                {isUploadingThis ? (
                                                                    <>
                                                                        <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                                                                        <span className="text-[6px] text-amber-300 font-bold uppercase mt-1">UPLOADING</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Upload size={14} className="text-amber-400 group-hover:scale-110 transition-transform mb-0.5" />
                                                                        <span className="text-[7px] font-black text-amber-300 uppercase text-center">MUAT NAIK DO</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={idx} className="relative rounded-lg border border-dashed border-slate-800 bg-slate-950/50 aspect-square flex items-center justify-center">
                                                            <span className="text-[7px] font-black text-slate-600 uppercase text-center">NO PHOTO</span>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="relative rounded-lg overflow-hidden border border-slate-700 bg-black aspect-square cursor-zoom-in group/img"
                                                        onClick={() => setPreviewImageUrl(url)}
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`POD ${idx + 1}`}
                                                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-[8px] font-black text-emerald-400 px-1 py-0.2 rounded uppercase">
                                                            {isDo ? 'DO' : 'Barang'}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Missing Drops Placeholders in History */}
                                            {Array.from({ length: Math.max(0, orderTotalDrops - Math.ceil(rawPhotosList.length / 2)) }).map((_, missingIdx) => {
                                                const dropNum = Math.ceil(rawPhotosList.length / 2) + missingIdx + 1;
                                                return (
                                                    <div 
                                                        key={`missing-drop-hist-${dropNum}`} 
                                                        onClick={() => {
                                                            setSelectedOrderForDrop(order);
                                                            setAddDoPhotoBase64(null);
                                                            setAddProductPhotoBase64(null);
                                                            setAddDeliveryNote('');
                                                            triggerGpsFetch();
                                                            setIsAddDropModalOpen(true);
                                                        }}
                                                        className="col-span-2 relative rounded-lg border border-dashed border-amber-500/50 bg-amber-950/20 hover:bg-amber-900/30 transition-all p-2 flex items-center justify-between gap-2 cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-[9px]">
                                                                {dropNum}
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-black text-amber-300 uppercase block">Drop #{dropNum} Belum Lengkap</span>
                                                                <span className="text-[7px] text-slate-400">Ketik untuk muat naik</span>
                                                            </div>
                                                        </div>
                                                        <Camera size={13} className="text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Button to add extra drop or supplement photos */}
                                        <button
                                            onClick={() => {
                                                setSelectedOrderForDrop(order);
                                                setAddDoPhotoBase64(null);
                                                setAddProductPhotoBase64(null);
                                                setAddDeliveryNote('');
                                                triggerGpsFetch();
                                                setIsAddDropModalOpen(true);
                                            }}
                                            className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 rounded-xl font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-98"
                                        >
                                            <Camera size={13} className="text-emerald-400" />
                                            <span>+ Tambah Drop / DO & Foto (Kemaskini Rekod)</span>
                                        </button>
                                    </div>
                                )}

                                {/* Extra Job Photo Proof */}
                                {!rawPhotosList.length && extraJobPhoto && (
                                    <div className="mb-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                        <p className="text-[10px] text-emerald-400 font-black uppercase mb-2 flex items-center gap-1">
                                            📸 Bukti Gambar Tugasan / Task Photo Proof
                                        </p>
                                        <div
                                            className="w-full h-36 rounded-lg overflow-hidden border border-slate-700 bg-black relative cursor-zoom-in"
                                            onClick={() => setPreviewImageUrl(extraJobPhoto)}
                                        >
                                            <img
                                                src={extraJobPhoto}
                                                alt="Extra Job Proof"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Order / Driver Notes */}
                                {order.notes && (
                                    <div className="mb-3 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800 text-xs">
                                        <p className="text-[9px] text-slate-500 font-black uppercase mb-0.5">Catatan / Notes</p>
                                        <p className="text-slate-300 italic whitespace-pre-line text-[11px] leading-relaxed">
                                            {order.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Footer Timestamps */}
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-500">
                                    <div className="flex items-center gap-1 text-blue-400 font-bold uppercase">
                                        <Calendar size={12} />
                                        <span>Tarikh Hantar: {(order as any).deliveryDate || 'N/A'}</span>
                                    </div>
                                    {order.pod_timestamp && (
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <Clock size={12} />
                                            <span>Selesai: {new Date(order.pod_timestamp).toLocaleString('en-GB')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* HIDDEN FILE INPUTS */}
            <input
                ref={laterFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleLaterFileSelect}
            />
            <input
                ref={addCameraDoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleAddDropPhotoSelect(e, 'do')}
            />
            <input
                ref={addGalleryDoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAddDropPhotoSelect(e, 'do')}
            />
            <input
                ref={addCameraProdInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleAddDropPhotoSelect(e, 'product')}
            />
            <input
                ref={addGalleryProdInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAddDropPhotoSelect(e, 'product')}
            />

            {/* ADD DROP MODAL IN HISTORY */}
            {isAddDropModalOpen && selectedOrderForDrop && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                        <div>
                            <h2 className="font-black text-white text-lg flex items-center gap-2">
                                <span>TAMBAH DROP / DO & FOTO</span>
                                {(() => {
                                    const total = selectedOrderForDrop.trip_drop_count || 1;
                                    const currentDropNum = Math.floor((selectedOrderForDrop.pod_photo_url ? selectedOrderForDrop.pod_photo_url.split(',').length : 0) / 2) + 1;
                                    const isExtra = currentDropNum > total;
                                    return (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded border font-mono ${isExtra ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                            ({currentDropNum}/{total}{isExtra ? ' • Extra Drop' : ''})
                                        </span>
                                    );
                                })()}
                            </h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">{selectedOrderForDrop.orderNumber}</p>
                        </div>
                        <button 
                            onClick={() => {
                                setIsAddDropModalOpen(false);
                                setSelectedOrderForDrop(null);
                            }} 
                            className="p-2 bg-slate-800 rounded-full text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black">
                        {/* GPS Location Panel */}
                        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${fetchingGps ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    📍
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lokasi GPS / GPS Coordinate</p>
                                    <p className="text-white font-mono text-xs">{gpsCoordinates}</p>
                                </div>
                            </div>
                            <button
                                onClick={triggerGpsFetch}
                                disabled={fetchingGps}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-[10px] font-bold uppercase text-slate-300 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            >
                                <RefreshCw size={10} className={fetchingGps ? 'animate-spin' : ''} />
                                {fetchingGps ? 'GPS...' : 'RE-SYNC'}
                            </button>
                        </div>

                        {/* Unloading Photos (DO and Product) */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* DO Photo Slot */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                    1. GAMBAR DO (Delivery Order)
                                </label>
                                {addDoPhotoBase64 ? (
                                    <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner group">
                                        <img 
                                            src={`data:image/jpeg;base64,${addDoPhotoBase64}`} 
                                            alt="DO Photo" 
                                            className="w-full h-full object-cover cursor-zoom-in" 
                                            onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${addDoPhotoBase64}`)}
                                        />
                                        <button 
                                            onClick={() => setAddDoPhotoBase64(null)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors active:scale-90"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square rounded-xl border border-slate-800 bg-slate-900/30 p-2 flex flex-col items-center justify-center gap-2.5">
                                        {uploadingDropTarget === 'do' ? (
                                            <>
                                                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-blue-400 font-bold uppercase text-center px-2">Memproses...</span>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => addCameraDoInputRef.current?.click()}
                                                    disabled={submittingDrop}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <Camera size={14} className="text-emerald-400" />
                                                    📸 Kamera
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addGalleryDoInputRef.current?.click()}
                                                    disabled={submittingDrop}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <span>📁</span>
                                                    <span>Galeri</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Product Photo Slot */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                    2. GAMBAR BARANG (PRODUK)
                                </label>
                                {addProductPhotoBase64 ? (
                                    <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner group">
                                        <img 
                                            src={`data:image/jpeg;base64,${addProductPhotoBase64}`} 
                                            alt="Product Photo" 
                                            className="w-full h-full object-cover cursor-zoom-in" 
                                            onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${addProductPhotoBase64}`)}
                                        />
                                        <button 
                                            onClick={() => setAddProductPhotoBase64(null)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors active:scale-90"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square rounded-xl border border-slate-800 bg-slate-900/30 p-2 flex flex-col items-center justify-center gap-2.5">
                                        {uploadingDropTarget === 'product' ? (
                                            <>
                                                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-blue-400 font-bold uppercase text-center px-2">Memproses...</span>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => addCameraProdInputRef.current?.click()}
                                                    disabled={submittingDrop}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <Camera size={14} className="text-emerald-400" />
                                                    📸 Kamera
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addGalleryProdInputRef.current?.click()}
                                                    disabled={submittingDrop}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                >
                                                    <span>📁</span>
                                                    <span>Galeri</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Delivery Note */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                3. CATATAN PENGHANTARAN / REMARK
                            </label>
                            <textarea
                                value={addDeliveryNote}
                                onChange={e => setAddDeliveryNote(e.target.value)}
                                placeholder="Tuliskan nota penghantaran atau maklumat drop tambahan di sini..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24 text-sm transition-all"
                            />
                        </div>

                        {/* Previously Uploaded Photos */}
                        {selectedOrderForDrop.pod_photo_url && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                                    GAMBAR HANTARAN TERDAHULU / PREVIOUSLY UPLOADED
                                </label>
                                <div className="grid grid-cols-4 gap-2 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                                    {selectedOrderForDrop.pod_photo_url.split(',').map((url: string, idx: number) => {
                                        if (!url.trim()) return null;
                                        return (
                                            <div key={idx} className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-square">
                                                <img 
                                                    src={url} 
                                                    alt={`POD - ${idx + 1}`} 
                                                    className="w-full h-full object-cover cursor-zoom-in" 
                                                    onClick={() => setPreviewImageUrl(url)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Submit Button */}
                    <div className="p-4 bg-slate-900 border-t border-slate-800 safe-bottom-padding">
                        <button
                            onClick={handleConfirmAddDrop}
                            disabled={submittingDrop}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {submittingDrop ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>MEMUAT NAIK...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} />
                                    <span>SIMPAN DROP & FOTO / SAVE DROP</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* FULLSCREEN IMAGE PREVIEW MODAL */}
            {previewImageUrl && (
                <div
                    className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setPreviewImageUrl(null)}
                >
                    <button
                        onClick={() => setPreviewImageUrl(null)}
                        className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white z-10 transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={previewImageUrl}
                        alt="Enlarged Preview"
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <p className="text-slate-400 text-xs mt-3 font-mono">Ketik di luar untuk tutup / Tap outside to close</p>
                </div>
            )}
        </div>
    );
};

export default DriverHistory;

