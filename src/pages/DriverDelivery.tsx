import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Truck, CheckCircle, Package, ChevronRight, X, RefreshCw, Camera, Image as ImageIcon, QrCode } from 'lucide-react';
import { SalesOrder } from '../types';
import { Scanner } from '@yudiel/react-qr-scanner';


interface DriverDeliveryProps {
    user: any;
}

const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
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
                reject(new Error("File processing failed"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const DriverDelivery: React.FC<DriverDeliveryProps> = ({ user }) => {
    // State
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
    
    // Lorry Binding State
    const [currentLorry, setCurrentLorry] = useState<any>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // NAIK BARANG (Load Items) State
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [loadItems, setLoadItems] = useState<any[]>([]); // Items to verify
    const [submitting, setSubmitting] = useState(false);
    const [loadPhotoBase64, setLoadPhotoBase64] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PICK UP State
    const [isPickUpModalOpen, setIsPickUpModalOpen] = useState(false);
    const [pickUpNote, setPickUpNote] = useState('');
    const [pickupLocation, setPickupLocation] = useState<string>('Searching GPS...');
    const pickUpFileInputRef = useRef<HTMLInputElement>(null);




    // 1. Fetch Data
    const fetchTasks = async () => {
        setLoading(true);
        if (!user?.uid) return;

        try {
            // Fetch Driver's tied lorry
            const { data: lorryData } = await supabase
                .from('lorries')
                .select('*')
                .eq('driver_id', user.uid)
                .single();
                
            setCurrentLorry(lorryData || null);

            // Fetch assigned orders with items
            const { data } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('driver_id', user.uid)
                .neq('status', 'Cancelled')
                .order('deadline', { ascending: false });

            if (data) {
                // Map DB snake_case to TS camelCase
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    zone: item.zone || item.delivery_zone,
                    deliveryDate: item.deadline, // Use Deadline as Delivery Date
                    orderDate: item.order_date || item.orderDate // Map date
                }));

                // Client-side sort
                const sorted = mapped.sort((a: any, b: any) => {
                    // "New" or "Assigned" first (Need Loading)
                    // "Loaded" next
                    // "Delivered" last (handled by tab filter)
                    const statusA = a.status;
                    const statusB = b.status;

                    const getStatusPriority = (status: string) => {
                        if (status === 'Assigned' || status === 'New') return 1;
                        if (status === 'Loaded') return 2;
                        return 3; // Other statuses, including 'Delivered'
                    };

                    const priorityA = getStatusPriority(statusA);
                    const priorityB = getStatusPriority(statusB);

                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }

                    return (a.stop_sequence || 999) - (b.stop_sequence || 999);
                });
                setTasks(sorted);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [user]);


    // 2. Open Load Modal
    const handleOpenLoadModal = (order: SalesOrder) => {
        setSelectedOrder(order);
        // Deep copy items to allow editing quantity if needed (default same qty)
        setLoadItems(order.items?.map(i => ({ ...i, confirmedQty: i.quantity })) || []);
        setIsLoadModalOpen(true);
    };

    // 3. Submit Loading (Deduct Stock)
    const handleConfirmLoad = async (photoBase64Str?: string) => {
        if (!selectedOrder) return;
        const finalPhoto = photoBase64Str || loadPhotoBase64;
        if (!finalPhoto) {
            alert("⚠️ Sila ambil gambar barangan yang dimuatkan dahulu! / Please take a photo of the loaded goods first!");
            return;
        }

        setSubmitting(true);
        let photoUrl = '';

        try {
            // Upload Photo First
            try {
                const fileName = `load_${selectedOrder.orderNumber}_${Date.now()}.jpg`;
                const blob = await fetch(`data:image/jpeg;base64,${finalPhoto}`).then(r => r.blob());

                const { error: uploadError } = await supabase.storage
                    .from('work-photos')
                    .upload(fileName, blob, { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
                photoUrl = urlData.publicUrl;
            } catch (err: any) {
                console.error("Photo Upload Error:", err);
                throw new Error("Gagal memuat naik gambar. Sila cuba lagi. / Failed to upload photo. Please try again.");
            }
            // Check for Amendments
            const hasAmendments = loadItems.some(item => item.confirmedQty !== undefined && item.confirmedQty !== item.quantity);

            if (hasAmendments) {
                // 1. UPDATE ORDER with new quantities & Pending Approval Status
                // Map items to update quantities permanently
                const updatedItems = selectedOrder.items?.map(original => {
                    const match = loadItems.find(li => li.sku === original.sku && li.remark === original.remark);
                    return {
                        ...original,
                        quantity: match?.confirmedQty ?? original.quantity,
                        original_quantity: original.quantity // Keep track of original
                    };
                });

                await supabase.from('sales_orders').update({
                    status: 'Pending Approval',
                    items: updatedItems,
                    notes: (selectedOrder.notes || '') + ` | Amended by Driver: ${user?.name}`,
                    proof_of_load_url: photoUrl
                }).eq('id', selectedOrder.id);

                alert("⚠️ Kuantiti pesanan berubah. Menunggu kelulusan logistik. / Order quantity changed. Pending logistics approval.");

            } else {
                // 2. NO AMENDMENTS - Stock already deducted at order creation via DB trigger
                //    Just update status to Delivered

                const { data: updatedData, error: updateError } = await supabase.from('sales_orders').update({
                    status: 'Delivered',
                    pod_timestamp: new Date().toISOString(),
                    proof_of_load_url: photoUrl
                }).eq('id', selectedOrder.id).select();

                if (updateError) throw updateError;
                if (!updatedData || updatedData.length === 0) {
                    throw new Error("Update failed: Permission denied or Order not found. (RLS Check Failed)");
                }

                // Optimistic Update: Move to Done locally
                setTasks(prev => prev.map(t => {
                    if (t.id === selectedOrder.id) {
                        return { ...t, status: 'Delivered' };
                    }
                    return t;
                }));
                // alert("✅ Stock Deducted & Loaded!");
            }

            setIsLoadModalOpen(false);
            setLoadPhotoBase64(null); // Reset Photo
            // fetchTasks(); // Removed to prevent race condition. Optimistic update handles UI.

        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // 4. Handle Photo Capture
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isPickUp: boolean = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingPhoto(true);

            // Immediately attempt to fetch GPS if it is a Pick Up
            if (isPickUp) {
                setPickupLocation('Fetching GPS...');
                if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            setPickupLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
                        },
                        (error) => {
                            console.warn("GPS Error:", error);
                            setPickupLocation('GPS Unavailable');
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                } else {
                    setPickupLocation('GPS Not Supported');
                }
            }

            const dataUrl = await compressImage(file);
            const base64 = dataUrl.split(',')[1];
            setLoadPhotoBase64(base64);

            if (isPickUp) {
                setIsPickUpModalOpen(true);
                setUploadingPhoto(false); // Only end loading state for pickup here
            } else {
                // Auto-confirm the load!
                await handleConfirmLoad(base64);
                setUploadingPhoto(false);
            }
        } catch (err: any) {
            alert('Failed to process photo: ' + err.message);
            setUploadingPhoto(false);
        }
    };

    // 5. Submit Ad-Hoc Pick Up
    const handleConfirmPickUp = async () => {
        if (!loadPhotoBase64) {
            alert("⚠️ Sila ambil gambar barangan kutipan dahulu! / Please take a photo of the collected goods first!");
            return;
        }
        
        setSubmitting(true);
        try {
            // Upload Photo
            const fileName = `pickup_${user?.employeeId}_${Date.now()}.jpg`;
            const blob = await fetch(`data:image/jpeg;base64,${loadPhotoBase64}`).then(r => r.blob());

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) {
                console.error('Storage Upload Error:', uploadError);
                throw new Error("Storage Upload failed: " + uploadError.message);
            }

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const photoUrl = urlData.publicUrl;

            // Generate an order number for this ad-hoc pick up
            const pickupOrderNo = `TRIP-PU-${Date.now().toString().slice(-6)}`;

            // Insert via SECURITY DEFINER RPC to bypass Row-Level Security
            const { data, error } = await supabase.rpc('create_driver_pickup_safe', {
                p_order_number: pickupOrderNo,
                p_driver_id: user?.uid,
                p_notes: pickUpNote,
                p_photo_url: photoUrl,
                p_location: pickupLocation
            });

            if (error) {
                console.error('RPC Error:', error);
                throw new Error("RPC Insert failed: " + error.message);
            }

            // Optimistic update
            if (data) {
                const newOrderRecord = data as any;
                const mapped = {
                    ...newOrderRecord,
                    orderNumber: newOrderRecord.order_number,
                    deliveryAddress: newOrderRecord.delivery_address,
                    zone: newOrderRecord.zone,
                    deliveryDate: newOrderRecord.deadline,
                };
                setTasks(prev => [mapped, ...prev]);
            }

            // Reset and close
            setIsPickUpModalOpen(false);
            setLoadPhotoBase64(null);
            setPickUpNote('');
            alert("✅ Tugasan kutipan berjaya direkodkan! / Pick Up task recorded successfully!");
        } catch (e: any) {
            alert("Error saving pickup: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // 6. Bind Lorry (Scan QR)
    const handleScanComplete = async (text: string) => {
        try {
            setSubmitting(true);
            const data = JSON.parse(text);
            
            if (data.type !== 'LorryBind' || !data.lorryId) {
                throw new Error("Kod QR tidak sah. Bukan QR Lori. / Invalid QR Code. Not a Lorry QR.");
            }

            // 1. Unbind driver from any current lorry
            await supabase.from('lorries').update({ driver_id: null, driver_name: null, status: 'Available' }).eq('driver_id', user.uid);
            
            // 2. Bind driver to new lorry
            const { error: bindError } = await supabase.from('lorries')
                .update({ 
                    driver_id: user.uid, 
                    driver_name: user.name || user.email, 
                    status: 'On-Route' 
                })
                .eq('id', data.lorryId);

            if (bindError) throw bindError;

            alert("✅ Lori Berjaya Ditambat! / Lorry Bound Successfully!");
            setIsScannerOpen(false);
            fetchTasks(); // Refresh lorry status
            
        } catch (err: any) {
            alert(`Scan Error: ${err.message || 'Invalid format'}`);
        } finally {
            setSubmitting(false);
        }
    };

    // 7. Unbind Lorry (End Trip)
    const handleUnbindLorry = async () => {
        if (!currentLorry) return;
        if (!window.confirm("Tamat Syif dan Lepaskan Lori? / End Shift and Unbind Lorry?")) return;
        
        try {
            setSubmitting(true);
            const { error } = await supabase.from('lorries')
                .update({ driver_id: null, driver_name: null, status: 'Available' })
                .eq('id', currentLorry.id);
                
            if (error) throw error;
            setCurrentLorry(null);
            alert("Lori berjaya dilepaskan. / Lorry unbound successfully.");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Real-time Subscription
    useEffect(() => {
        if (!user?.uid) return;

        console.log("Subscribing to driver orders:", user.uid);
        const subscription = supabase
            .channel(`driver-orders-${user.uid}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'sales_orders',
                filter: `driver_id=eq.${user.uid}`
            }, (payload) => {
                console.log("Realtime Update Recieved!", payload);
                fetchTasks();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    // View Logic
    const todoList = tasks.filter(t => t.status !== 'Delivered' && t.status !== 'Pending Approval' && t.status !== 'Cancelled');
    const doneList = tasks.filter(t => t.status === 'Delivered' || t.status === 'Pending Approval');
    const displayList = activeTab === 'todo' ? todoList : doneList;

    return (
        <div className="min-h-screen bg-black text-slate-200 pb-20 font-sans">
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
                <p className="text-[10px] font-bold text-slate-500 uppercase">{user?.name || 'Pemandu'} • {tasks.length} Pesanan / Orders</p>
                <div className="flex items-center gap-2">
                    <input
                        ref={pickUpFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, true)}
                    />
                    <button
                        onClick={() => pickUpFileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        {uploadingPhoto ? (
                            <span>SEDANG DIPROSES...</span>
                        ) : (
                            <>
                                <span>🚛</span>
                                <span className="hidden sm:inline"> REKOD KUTIPAN / RECORD PICK UP</span>
                                <span className="inline sm:hidden"> REKOD KUTIPAN</span>
                            </>
                        )}
                    </button>



                    <button
                        onClick={() => fetchTasks()}
                        disabled={loading}
                        className="p-1.5 bg-slate-800 rounded-lg text-blue-400 border border-slate-700 active:scale-95 transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Current Lorry Banner */}
            <div className="px-4 pt-4">
                {currentLorry ? (
                    <div className="bg-blue-600/20 border border-blue-500/50 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600/30 rounded-xl flex items-center justify-center text-blue-400">
                                <Truck size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Lori Sekarang / Current Lorry</p>
                                <p className="text-white font-bold">{currentLorry.plate_number}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleUnbindLorry}
                            disabled={submitting}
                            className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-300 tracking-wider transition-all disabled:opacity-50"
                        >
                            TAMAT SYIF / END SHIFT
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="w-full bg-slate-800/80 hover:bg-slate-700/80 border-2 border-dashed border-slate-600 rounded-2xl p-4 flex items-center justify-center gap-3 transition-all"
                    >
                        <QrCode className="text-blue-400" size={24} />
                        <div className="text-left">
                            <p className="text-sm font-black text-white uppercase tracking-wider">Ketik untuk Imbas QR Lori / Tap to Scan Lorry QR</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tambat lori untuk mulakan laluan / Bind lorry to start route</p>
                        </div>
                    </button>
                )}
            </div>

            {/* TABS */}
            <div className="p-4 flex gap-2">
                <button
                    onClick={() => setActiveTab('todo')}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm tracking-wider transition-all ${activeTab === 'todo' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 text-slate-500'
                        }`}
                >
                    Dalam Proses / Pending ({todoList.length})
                </button>
                <button
                    onClick={() => setActiveTab('done')}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm tracking-wider transition-all ${activeTab === 'done' ? 'bg-green-600/20 text-green-500 border border-green-500/30' : 'bg-slate-900 text-slate-500'
                        }`}
                >
                    Selesai / Done ({doneList.length})
                </button>
            </div>

            {/* LIST */}
            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-500 animate-pulse">Memuatkan... / Loading...</div>
                ) : displayList.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={40} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-500">Tiada pesanan ditemui. / No orders found.</h3>
                    </div>
                ) : (
                    displayList.map((order) => (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative">
                            {/* Status Strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${order.status === 'Delivered' ? 'bg-green-500' :
                                order.status === 'Pending Approval' ? 'bg-yellow-500' :
                                    'bg-blue-500'
                                }`} />

                            {/* Card Body */}
                            <div className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-6">
                                    {/* Swapped: State is now main title, Customer is subtitle */}
                                    <div>
                                        <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                            {(order as any).trip_origin && <span className="text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{(order as any).trip_origin}</span>}
                                            {order.zone && <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">{order.zone}</span>}
                                            {(order as any).trip_drop_count > 1 && <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">{(order as any).trip_drop_count} Hentian / Drops</span>}
                                        </div>
                                        <h2 className="text-lg font-black text-white line-clamp-2 leading-tight">{order.deliveryAddress || order.zone || 'No Route Specified'}</h2>
                                        {(order as any).deliveryDate && (
                                            <div className="flex items-center gap-2 mt-1 text-xs font-bold uppercase tracking-wider">
                                                <span className="text-orange-500">
                                                    {['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date((order as any).deliveryDate).getDay()]}
                                                </span>
                                                <span className="text-blue-400">
                                                    {new Date((order as any).deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Order Notes */}
                            {order.notes && (
                                <div className="mb-4 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                    <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Nota / Notes</p>
                                    <p className="text-sm text-slate-300">{order.notes}</p>
                                </div>
                            )}

                            {/* Items Summary with Remarks (Grouped by Location) */}
                            <div className="space-y-3 mb-6">
                                {(() => {
                                    const grouped = (order.items || []).reduce((acc: any, item: any) => {
                                        let loc = item.sourceLocation || 'Other Items';

                                        // Fallback legacy support if an old order STILL has Loc: hardcoded in its remark
                                        if (loc === 'Other Items' && item.remark && item.remark.includes('Loc:')) {
                                            const match = item.remark.match(/Loc:\s*([^)\n\r,]+)/);
                                            if (match) loc = match[1].trim();
                                        }

                                        if (loc.toLowerCase() === 'general') loc = 'Other Items';
                                        if (!acc[loc]) acc[loc] = [];
                                        acc[loc].push(item);
                                        return acc;
                                    }, {});

                                    return Object.entries(grouped).map(([loc, items]: [string, any]) => (
                                        <div key={loc} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                                <Package size={10} /> {loc === 'Other Items' ? 'Barangan Lain / Other Items' : loc}
                                            </div>
                                            <div className="space-y-2">
                                                {items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-800/50 last:border-0 pb-1 last:pb-0">
                                                        <div>
                                                            <span className="font-bold text-white">{item.quantity} x {item.product || item.sku}</span>
                                                            {/* Display Remark (Legacy strip Loc: just in case) */}
                                                            {item.remark && (
                                                                <div className="text-[11px] text-amber-500 font-mono mt-0.5">
                                                                    {item.remark.replace(/Loc:\s*[^)\n\r,]+/, '').trim() || item.remark}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>


                            {/* ACTION BUTTON (Only for To-Do) */}
                            {activeTab === 'todo' && (
                                <button
                                    onClick={() => handleOpenLoadModal(order)}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 active:scale-95 transition-all"
                                >
                                    <Truck size={18} /> Naik Barang
                                    <ChevronRight size={16} className="opacity-50" />
                                </button>
                            )}

                            {activeTab === 'done' && (
                                <div className={`text-center py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 ${order.status === 'Pending Approval'
                                    ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                                    : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                    }`}>
                                    {order.status === 'Pending Approval' ? (
                                        <>
                                            <Truck size={14} /> Menunggu kelulusan logistik / Pending logistics approval
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={14} /> Stok Ditolak / Stock Deducted
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                    ))
                )}
            </div>

            {/* LOADING MODAL */}
            {
                isLoadModalOpen && selectedOrder && (
                    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                            <div>
                                <h2 className="font-black text-white text-lg">SAHKAN STOK / VERIFY STOCK</h2>
                                <p className="text-[10px] text-slate-500 uppercase font-bold">{selectedOrder.orderNumber}</p>
                            </div>
                            <button onClick={() => setIsLoadModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                        </div>

                        {/* ITEMS LIST (GROUPED BY LOCATION) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black">
                            {/* Group items by Location parsed from remark "Loc: xxx" */}
                            {(() => {
                                const grouped: Record<string, any[]> = {};
                                try {
                                    (loadItems || []).forEach(item => {
                                        let loc = item.sourceLocation || 'Other Items';

                                        // Fallback legacy support
                                        if (loc === 'Other Items' && item && typeof item.remark === 'string') {
                                            const match = item.remark.match(/Loc:\s*([^)\n\r,]+)/);
                                            if (match) loc = match[1].trim();
                                        }

                                        if (loc.toLowerCase() === 'general') loc = 'Other Items';

                                        if (!grouped[loc]) grouped[loc] = [];
                                        grouped[loc].push(item);
                                    });
                                } catch (err) {
                                    console.error("Grouping Error:", err);
                                    return <div className="text-red-500 p-4">Error loading items. Please contact support.</div>;
                                }

                                const groups = Object.entries(grouped);
                                if (groups.length === 0) {
                                    return <div className="text-gray-500 text-center p-10">No items found in this order.</div>;
                                }

                                return groups.map(([location, items]) => (
                                    <div key={location}>
                                        {/* Location Header */}
                                        <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 border-b border-blue-500/20 pb-1">
                                            {location}
                                        </div>

                                        {/* Items in this location */}
                                        <div className="space-y-3">
                                            {items.map((item, idx) => {
                                                // Find original index in loadItems to update state correctly
                                                // Fallback to index if find fails (though it shouldn't)
                                                const originalIdx = loadItems.findIndex(i => i === item);
                                                if (originalIdx === -1) return null;

                                                return (
                                                    <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 font-bold border border-slate-700 text-xs">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-white font-bold text-sm">{(item as any).product || (item as any).name || (item as any).sku || 'Barang Tidak Diketahui / Unknown Item'}</div>
                                                            <div className="text-[10px] text-slate-500 font-mono">Kuantiti / Qty: {item.quantity} {(item as any).packaging || (item as any).uom || ''}</div>
                                                        </div>

                                                        {/* Quantity Editor */}
                                                        <div className="flex flex-col items-end gap-1">
                                                            <input
                                                                type="number"
                                                                className="w-16 bg-black border border-slate-700 rounded-lg p-2 text-center text-lg font-bold text-green-400 focus:border-green-500 outline-none"
                                                                value={loadItems[originalIdx].confirmedQty ?? item.quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const newQty = val === '' ? 0 : parseInt(val);
                                                                    const newItems = [...loadItems];
                                                                    newItems[originalIdx].confirmedQty = isNaN(newQty) ? 0 : newQty;
                                                                    setLoadItems(newItems);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer Camera Auto-Submit */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3 safe-bottom-padding">
                            <div className="flex justify-between text-xs font-bold text-slate-400 uppercase">
                                <span>Jumlah Barang / Total Items</span>
                                <span className="text-white">{(loadItems || []).reduce((acc, i) => acc + (i.confirmedQty ?? i.quantity ?? 0), 0)} Unit / Units</span>
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={submitting || uploadingPhoto}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-green-900/40 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {submitting || uploadingPhoto ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>SEDANG DIPROSES... / PROCESSING...</span>
                                    </>
                                ) : (
                                    <>
                                        <Camera size={20} />
                                        <span>AMBIL GAMBAR & SAHKAN / TAKE PHOTO & CONFIRM</span>
                                    </>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handleFileSelect(e, false)}
                            />
                        </div>
                    </div>
                )
            }

            {/* PICK UP MODAL AD-HOC */}
            {isPickUpModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                        <div>
                            <h2 className="font-black text-emerald-400 text-lg flex items-center gap-2"><Truck size={20} /> REKOD KUTIPAN / LOG PICK UP</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Kutipan Ad-Hoc / Ad-Hoc Collection</p>
                        </div>
                        <button onClick={() => { setIsPickUpModalOpen(false); setLoadPhotoBase64(null); }} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-black">
                        {/* PHOTO MANDATORY */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">1. BUKTI GAMBAR / PHOTO PROOF</label>
                            {!loadPhotoBase64 ? (
                                <button
                                    onClick={() => pickUpFileInputRef.current?.click()}
                                    className="w-full py-10 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 flex flex-col items-center gap-3"
                                >
                                    <ImageIcon size={32} className="text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-400">
                                        {uploadingPhoto ? 'SEDANG DIPROSES / PROCESSING...' : 'AMBIL GAMBAR SEMULA / TAKE PHOTO AGAIN'}
                                    </span>
                                </button>
                            ) : (
                                <div className="w-full relative rounded-xl overflow-hidden border border-slate-700">
                                    <img src={`data:image/jpeg;base64,${loadPhotoBase64}`} alt="Pick Up" className="w-full h-48 object-cover" />
                                    <button 
                                        onClick={() => setLoadPhotoBase64(null)}
                                        className="absolute top-3 right-3 p-2 bg-red-500 rounded-full text-white shadow-lg"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                                {/* Input already defined at header level, no need to duplicate here since it's triggered via ref */}
                        </div>

                        {/* NOTE */}
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">2. CATATAN / REMARKS</label>
                            <textarea
                                value={pickUpNote}
                                onChange={e => setPickUpNote(e.target.value)}
                                placeholder="Contoh: Kotak dipulangkan dari Pembekal ABC (e.g. Returned Cartons from Supplier ABC)"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none resize-none h-32"
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900 safe-bottom-padding">
                        <button
                            onClick={handleConfirmPickUp}
                            disabled={submitting || !loadPhotoBase64}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {submitting ? 'SEDANG DIPROSES / PROCESSING...' : 'SAHKAN KUTIPAN / CONFIRM PICK UP'}
                        </button>
                    </div>
                </div>
            )}

            {/* SCANNER MODAL */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                        <h2 className="font-black text-white text-lg flex items-center gap-2"><QrCode size={20} className="text-blue-500" /> IMBAS QR LORI / SCAN LORRY QR</h2>
                        <button onClick={() => setIsScannerOpen(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
                        <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-4 border-slate-800 relative shadow-2xl">
                            {submitting ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-blue-400 gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    <span className="font-black tracking-widest text-xs uppercase">Menghubungkan... / Binding...</span>
                                </div>
                            ) : null}
                            <Scanner 
                               onScan={(detectedCodes) => {
                                   if (detectedCodes && detectedCodes.length > 0) {
                                       handleScanComplete(detectedCodes[0].rawValue);
                                   }
                               }}
                               formats={['qr_code']}
                            />
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-8 text-center max-w-xs">
                            Halakan kamera anda ke kod QR di papan pemuka lori untuk mendaftar syif anda. / Point your camera at the QR code on the lorry dashboard to bind your shift.
                        </p>
                    </div>
                </div>
            )}

        </div >
    );
};

export default DriverDelivery;
