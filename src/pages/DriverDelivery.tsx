import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Truck, CheckCircle, Package, ChevronRight, X, RefreshCw, Camera, Image as ImageIcon, QrCode, Upload } from 'lucide-react';
import { SalesOrder } from '../types';
import { Scanner } from '@yudiel/react-qr-scanner';
import { parsePrepPhotos } from '../utils/prepPhotos';
import { dataURLtoBlob } from '../utils/imageCompress';



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

const watermarkImage = (base64Str: string, textLines: string[]): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const w = img.width;
            const h = img.height;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            
            // Draw original image
            ctx.drawImage(img, 0, 0, w, h);
            
            // Add watermarking overlay
            const bannerHeight = Math.max(50, Math.floor(h * 0.12)); 
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
            ctx.fillRect(0, h - bannerHeight, w, bannerHeight);
            
            // Font setup
            const fontSize = Math.max(12, Math.floor(bannerHeight / (textLines.length + 1)));
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = '#ffffff'; // White text
            ctx.textBaseline = 'top';
            
            // Draw text lines
            const paddingLeft = Math.max(15, Math.floor(w * 0.03));
            const totalTextHeight = textLines.length * fontSize * 1.25;
            const paddingTop = h - bannerHeight + (bannerHeight - totalTextHeight) / 2;
            
            textLines.forEach((line, index) => {
                let drawLine = line;
                const maxTextWidth = w - paddingLeft * 2;
                if (ctx.measureText(line).width > maxTextWidth) {
                    while (drawLine.length > 5 && ctx.measureText(drawLine + '...').width > maxTextWidth) {
                        drawLine = drawLine.slice(0, -1);
                    }
                    drawLine += '...';
                }
                ctx.fillText(drawLine, paddingLeft, paddingTop + (index * fontSize * 1.25));
            });
            
            // Output as Jpeg
            const watermarkedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(watermarkedDataUrl.split(',')[1]); // return just the base64 part
        };
        img.onerror = reject;
        img.src = `data:image/jpeg;base64,${base64Str}`;
    });
};

const fetchAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
        const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lng })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.address) {
            return data.address;
        }
        throw new Error(data.error || 'Geocoding failed');
    } catch (err) {
        console.warn('Geocoding error:', err);
        return `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    }
};

const DriverDelivery: React.FC<DriverDeliveryProps> = ({ user }) => {
    // State
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
    
    // Lorry Binding State
    const [currentLorry, setCurrentLorry] = useState<any>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerMode, setScannerMode] = useState<'bind' | 'unbind'>('bind');

    // Lorry Mileage & Odometer State
    const [scannedLorryData, setScannedLorryData] = useState<any>(null);
    const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false);
    const [odometerPhotoBase64, setOdometerPhotoBase64] = useState<string | null>(null);
    const [detectedMileage, setDetectedMileage] = useState<number | null>(null);
    const [confirmedMileage, setConfirmedMileage] = useState<string>('');
    const [isAnalyzingOdometer, setIsAnalyzingOdometer] = useState(false);
    const [submittingOdometer, setSubmittingOdometer] = useState(false);
    const odometerCameraInputRef = useRef<HTMLInputElement>(null);

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

    // SAHKAN HANTARAN (Unload Items) State
    const [isUnloadModalOpen, setIsUnloadModalOpen] = useState(false);
    const [unloadDoPhotoBase64, setUnloadDoPhotoBase64] = useState<string | null>(null);
    const [unloadProductPhotoBase64, setUnloadProductPhotoBase64] = useState<string | null>(null);
    const [uploadingTarget, setUploadingTarget] = useState<'do' | 'product' | null>(null);
    const activeFileInputRef = useRef<'do' | 'product' | null>(null);
    const [deliveryNote, setDeliveryNote] = useState('');
    const [gpsCoordinates, setGpsCoordinates] = useState<string>('Fetching GPS...');
    const [fetchingGps, setFetchingGps] = useState(false);
    const [isFinalDrop, setIsFinalDrop] = useState(false);
    const unloadCameraInputRef = useRef<HTMLInputElement>(null);
    const unloadGalleryInputRef = useRef<HTMLInputElement>(null);

    // Later DO Upload State
    const [laterUploadTarget, setLaterUploadTarget] = useState<{ orderId: string, photoIndex: number } | null>(null);
    const [laterUploading, setLaterUploading] = useState(false);
    const laterFileInputRef = useRef<HTMLInputElement>(null);




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
                        if (status === 'Loaded' || status === 'Pending Approval') return 2;
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
                const blob = dataURLtoBlob(`data:image/jpeg;base64,${finalPhoto}`);

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

                // Optimistic Update: Move to Pending Approval locally so button changes to Confirm Delivery immediately
                setTasks(prev => prev.map(t => {
                    if (t.id === selectedOrder.id) {
                        return { 
                            ...t, 
                            status: 'Pending Approval', 
                            items: updatedItems, 
                            proof_of_load_url: photoUrl 
                        };
                    }
                    return t;
                }));

            } else {
                // 2. NO AMENDMENTS - Stock already deducted at order creation via DB trigger
                //    Just update status to Loaded

                const { data: updatedData, error: updateError } = await supabase.from('sales_orders').update({
                    status: 'Loaded',
                    proof_of_load_url: photoUrl
                }).eq('id', selectedOrder.id).select();

                if (updateError) throw updateError;
                if (!updatedData || updatedData.length === 0) {
                    throw new Error("Update failed: Permission denied or Order not found. (RLS Check Failed)");
                }

                // Optimistic Update: Move to Loaded locally
                setTasks(prev => prev.map(t => {
                    if (t.id === selectedOrder.id) {
                        return { ...t, status: 'Loaded' };
                    }
                    return t;
                }));
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
                        async (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            setPickupLocation(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
                            
                            // Reverse geocode to address
                            const address = await fetchAddressFromCoords(lat, lng);
                            setPickupLocation(address);
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
            const blob = dataURLtoBlob(`data:image/jpeg;base64,${loadPhotoBase64}`);

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

    // 5b. Unloading handlers (Confirm Delivery / Sahkan Hantaran)
    const handleOpenUnloadModal = (order: SalesOrder) => {
        setSelectedOrder(order);
        setUnloadDoPhotoBase64(null);
        setUnloadProductPhotoBase64(null);
        setDeliveryNote('');
        setGpsCoordinates('Fetching GPS...');
        setIsFinalDrop(false); // Force false, trip completion is handled by QR code return scan at base
        setIsUnloadModalOpen(true);
        triggerGpsFetch();
    };

    const triggerGpsFetch = () => {
        setFetchingGps(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const coords = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
                    setGpsCoordinates(coords);
                    setFetchingGps(false);

                    // Asynchronously resolve address
                    const address = await fetchAddressFromCoords(lat, lng);
                    setGpsCoordinates(address);
                },
                (error) => {
                    console.warn("GPS Error:", error);
                    setGpsCoordinates('GPS Unavailable');
                    setFetchingGps(false);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            setGpsCoordinates('GPS Not Supported');
            setFetchingGps(false);
        }
    };

    const handleUnloadPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const target = activeFileInputRef.current;
        if (!file || !target) return;

        try {
            setUploadingTarget(target);
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];
            
            // Format Watermark Text Lines
            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const typeLabel = target === 'do' ? 'DO PROOF / BUKTI DO' : 'CARGO PROOF / BUKTI BARANG';
            const lines = [
                `SO: ${selectedOrder?.orderNumber || ''} | Plate: ${currentLorry?.plate_number || 'No Lorry'}`,
                `Time: ${timeStr} | Type: ${typeLabel}`,
                `Location: ${gpsCoordinates}`
            ];

            const watermarkedBase64 = await watermarkImage(base64Only, lines);
            if (target === 'do') {
                setUnloadDoPhotoBase64(watermarkedBase64);
            } else {
                setUnloadProductPhotoBase64(watermarkedBase64);
            }
        } catch (err: any) {
            alert('Gagal memproses gambar / Failed to process photo: ' + err.message);
        } finally {
            setUploadingTarget(null);
            if (e.target) e.target.value = '';
        }
    };

    const extractDoNumberFromAi = async (base64Str: string): Promise<string> => {
        try {
            const response = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageBase64: base64Str, mode: 'do' })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.do_number || '';
        } catch (err) {
            console.error("AI DO extraction failed:", err);
            return '';
        }
    };

    const handleConfirmUnload = async () => {
        if (!selectedOrder) return;

        const confirmMsg = isFinalDrop
            ? "Adakah anda pasti mahu TAMATKAN TRIP ini?\n\nAre you sure you want to END this trip?"
            : "Adakah anda pasti mahu HANTAR drop point ini?\n\nAre you sure you want to SUBMIT this drop point?";
        if (!window.confirm(confirmMsg)) return;
        
        // Product Photo is required unless it's a final drop where photos are optional.
        // DO Photo is always optional during initial delivery (can be uploaded later).
        const needsProductPhoto = !isFinalDrop;
        if (needsProductPhoto && !unloadProductPhotoBase64) {
            alert("⚠️ Sila ambil gambar barang! / Please take the Product photo!");
            return;
        }

        setSubmitting(true);
        let doUrl = '';
        let prodUrl = '';
        let extractedDoNumber = '';

        try {
            // Extract DO Number with AI if DO photo is present
            if (unloadDoPhotoBase64) {
                try {
                    extractedDoNumber = await extractDoNumberFromAi(unloadDoPhotoBase64);
                } catch (err) {
                    console.warn("AI DO extraction failed:", err);
                }
            }

            // 1. Upload DO Photo
            if (unloadDoPhotoBase64) {
                try {
                    const doFileName = `unload_do_${selectedOrder.orderNumber}_${Date.now()}.jpg`;
                    const doBlob = dataURLtoBlob(`data:image/jpeg;base64,${unloadDoPhotoBase64}`);
                    const { error: doUploadError } = await supabase.storage
                        .from('work-photos')
                        .upload(doFileName, doBlob, { contentType: 'image/jpeg' });

                    if (doUploadError) throw doUploadError;
                    const { data: doUrlData } = supabase.storage.from('work-photos').getPublicUrl(doFileName);
                    doUrl = doUrlData.publicUrl;
                } catch (err: any) {
                    throw new Error("Gagal memuat naik gambar DO: " + err.message);
                }
            }

            // 2. Upload Product Photo
            if (unloadProductPhotoBase64) {
                try {
                    const prodFileName = `unload_prod_${selectedOrder.orderNumber}_${Date.now()}.jpg`;
                    const prodBlob = dataURLtoBlob(`data:image/jpeg;base64,${unloadProductPhotoBase64}`);
                    const { error: prodUploadError } = await supabase.storage
                        .from('work-photos')
                        .upload(prodFileName, prodBlob, { contentType: 'image/jpeg' });

                    if (prodUploadError) throw prodUploadError;
                    const { data: prodUrlData } = supabase.storage.from('work-photos').getPublicUrl(prodFileName);
                    prodUrl = prodUrlData.publicUrl;
                } catch (err: any) {
                    throw new Error("Gagal memuat naik gambar barang: " + err.message);
                }
            }

            // Append to existing photos as a structured pair [DO, Product] per drop
            const newPair = [doUrl, prodUrl];
            const existingPhotos = selectedOrder.pod_photo_url ? selectedOrder.pod_photo_url.split(',') : [];
            const newPhotos = [...existingPhotos, ...newPair];
            const podPhotoUrl = newPhotos.join(',');

            // Append driver notes to original order notes with timestamp
            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) + ' ' +
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            const hasNewPhotos = Boolean(doUrl) || Boolean(prodUrl);
            const defaultNote = hasNewPhotos ? "Proof uploaded" : "Trip completed";
            const newNoteSegment = deliveryNote.trim() 
                ? `[${timeStr}] ${deliveryNote.trim()}`
                : `[${timeStr}] ${defaultNote}`;

            let finalNote = selectedOrder.notes || '';
            if (finalNote) {
                finalNote = `${finalNote}\n${newNoteSegment}`;
            } else {
                finalNote = newNoteSegment;
            }

            // If the order status was 'Pending Approval', it remains in 'Pending Approval' status
            // so the admin still reviews and approves it later.
            const nextStatus = selectedOrder.status === 'Pending Approval'
                ? 'Pending Approval'
                : (isFinalDrop ? 'Delivered' : 'Loaded');

            // Check if column exists dynamically
            const hasExtractedDoCol = tasks.length > 0 && ('extracted_do_number' in tasks[0]);

            let updatedNotes = finalNote;
            if (extractedDoNumber) {
                const cleanNotes = (finalNote || '').replace(/\[AI DO:\s*.*?\]/g, '').trim();
                updatedNotes = cleanNotes 
                    ? `${cleanNotes}\n[AI DO: ${extractedDoNumber}]`
                    : `[AI DO: ${extractedDoNumber}]`;
            }

            const updatePayload: any = {
                status: nextStatus,
                pod_timestamp: new Date().toISOString(),
                pod_photo_url: podPhotoUrl,
                notes: updatedNotes
            };

            if (hasExtractedDoCol && extractedDoNumber) {
                updatePayload.extracted_do_number = extractedDoNumber;
            }

            // Update order status, set pod_photo_url, pod_timestamp, notes, etc.
            const { data: updatedData, error: updateError } = await supabase.from('sales_orders').update(updatePayload).eq('id', selectedOrder.id).select();

            if (updateError) throw updateError;
            if (!updatedData || updatedData.length === 0) {
                throw new Error("Update failed: Permission denied or Order not found. (RLS Check Failed)");
            }

            // Optimistic Update locally
            setTasks(prev => prev.map(t => {
                if (t.id === selectedOrder.id) {
                    const localUpdated: any = { 
                        ...t, 
                        status: nextStatus, 
                        pod_photo_url: podPhotoUrl, 
                        pod_timestamp: new Date().toISOString(), 
                        notes: updatedNotes 
                    };
                    if (hasExtractedDoCol && extractedDoNumber) {
                        localUpdated.extracted_do_number = extractedDoNumber;
                    }
                    return localUpdated;
                }
                return t;
            }));

            setIsUnloadModalOpen(false);
            setUnloadDoPhotoBase64(null);
            setUnloadProductPhotoBase64(null);
            setDeliveryNote('');

            if (isFinalDrop) {
                alert("✅ Trip selesai sepenuhnya! / Trip completed fully!");
            } else {
                alert("✅ Gambar & Catatan disimpan! Sila teruskan ke drop point seterusnya. / Photos & Note saved! Please proceed to the next drop point.");
            }
        } catch (err: any) {
            alert("Ralat mengesahkan penghantaran / Error confirming delivery: " + err.message);
        } finally {
            setSubmitting(false);
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
            // Compress image
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];

            // Load order details to get orderNumber (needed for fileName)
            const targetOrder = tasks.find(t => t.id === laterUploadTarget.orderId);
            if (!targetOrder) throw new Error("Order not found");

            // Format Watermark Text Lines
            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const lines = [
                `SO: ${targetOrder.orderNumber || ''} | Plate: ${currentLorry?.plate_number || 'No Lorry'}`,
                `Time: ${timeStr} | Type: DO PROOF (LATER) / BUKTI DO`,
                `Location: ${gpsCoordinates}`
            ];

            const watermarkedBase64 = await watermarkImage(base64Only, lines);

            // Extract DO Number with AI
            let extractedDoNumber = '';
            try {
                extractedDoNumber = await extractDoNumberFromAi(watermarkedBase64);
            } catch (err) {
                console.warn("AI DO extraction failed:", err);
            }

            // Upload to Supabase Storage
            const fileName = `unload_do_later_${targetOrder.orderNumber}_${Date.now()}.jpg`;
            const blob = dataURLtoBlob(`data:image/jpeg;base64,${watermarkedBase64}`);

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            // Fetch the current pod_photo_url from database to be accurate
            const { data: freshOrder, error: fetchErr } = await supabase
                .from('sales_orders')
                .select('pod_photo_url, notes, extracted_do_number')
                .eq('id', laterUploadTarget.orderId)
                .single();

            if (fetchErr) throw fetchErr;

            const hasExtractedDoCol = ('extracted_do_number' in freshOrder);

            const currentPhotos = freshOrder.pod_photo_url ? freshOrder.pod_photo_url.split(',') : [];
            
            // Expand or replace at photoIndex
            while (currentPhotos.length <= laterUploadTarget.photoIndex) {
                currentPhotos.push('');
            }
            currentPhotos[laterUploadTarget.photoIndex] = publicUrl;
            const updatedPodUrl = currentPhotos.join(',');

            // Construct notes update (fallback)
            let updatedNotes = freshOrder.notes || '';
            if (extractedDoNumber) {
                const cleanNotes = (freshOrder.notes || '').replace(/\[AI DO:\s*.*?\]/g, '').trim();
                updatedNotes = cleanNotes 
                    ? `${cleanNotes}\n[AI DO: ${extractedDoNumber}]`
                    : `[AI DO: ${extractedDoNumber}]`;
            }

            const updatePayload: any = { 
                pod_photo_url: updatedPodUrl,
                notes: updatedNotes
            };

            if (hasExtractedDoCol && extractedDoNumber) {
                updatePayload.extracted_do_number = extractedDoNumber;
            }

            // Update database
            const { error: updateErr } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', laterUploadTarget.orderId);

            if (updateErr) throw updateErr;

            alert("✅ Gambar DO berjaya dimuat naik! / DO Photo successfully uploaded!");
            
            // Refresh tasks
            fetchTasks();
        } catch (err: any) {
            alert("Gagal memproses/memuat naik gambar: " + err.message);
        } finally {
            setLaterUploading(false);
            setLaterUploadTarget(null);
            if (e.target) e.target.value = '';
        }
    };

    // 6. Bind Lorry (Scan QR)
    const handleScanComplete = async (text: string) => {
        try {
            let qrType = '';
            let lorryId = '';
            let plate = '';
            try {
                const data = JSON.parse(text);
                qrType = data.type;
                lorryId = data.lorryId;
                plate = data.plate || '';
            } catch (e) {
                // Keep default empty values
            }

            // Handle Unbind / Return Lorry (End Trip)
            if (scannerMode === 'unbind') {
                if (qrType !== 'LorryBind' || !lorryId || lorryId !== currentLorry?.id) {
                    throw new Error("Kod QR tidak sah. Sila imbas QR Lori yang sedang anda gunakan untuk mengesahkan pemulangan. / Invalid QR Code. Please scan the QR of the lorry you are currently using.");
                }

                setTimeout(() => setIsScannerOpen(false), 100);
                setScannedLorryData({ id: lorryId, mode: 'unbind', plate_number: currentLorry?.plate_number || 'Lorry' });
                setOdometerPhotoBase64(null);
                setDetectedMileage(null);
                setConfirmedMileage('');
                setIsOdometerModalOpen(true);
                return;
            }
            
            // Handle Bind Lorry
            if (qrType !== 'LorryBind' || !lorryId) {
                throw new Error("Kod QR tidak sah. Bukan QR Lori. / Invalid QR Code. Not a Lorry QR.");
            }

            setTimeout(() => setIsScannerOpen(false), 100);
            setScannedLorryData({ id: lorryId, mode: 'bind', plate_number: plate || 'Lorry' });
            setOdometerPhotoBase64(null);
            setDetectedMileage(null);
            setConfirmedMileage('');
            setIsOdometerModalOpen(true);
            
        } catch (err: any) {
            alert(`Scan Error: ${err.message || 'Invalid format'}`);
        }
    };

    // 6.1 Handle Odometer Photo Select & AI Extraction
    const handleOdometerPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !scannedLorryData) return;

        setIsAnalyzingOdometer(true);
        try {
            // Compress image
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];
            setOdometerPhotoBase64(base64Only);

            // Fetch AI extract from vision endpoint
            const response = await fetch('/api/agent/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64Only,
                    type: 'odometer'
                })
            });

            if (!response.ok) {
                throw new Error("Gagal menganalisis gambar dengan AI. / Failed to analyze image with AI.");
            }

            const data = await response.json();
            if (data && typeof data.mileage === 'number') {
                setDetectedMileage(data.mileage);
                setConfirmedMileage(data.mileage.toString());
            } else {
                setDetectedMileage(null);
                setConfirmedMileage('');
                alert("AI tidak dapat mengesan bacaan odometer. Sila masukkan secara manual. / AI could not detect odometer reading. Please enter manually.");
            }
        } catch (err: any) {
            console.error("Odometer AI Extract Error:", err);
            alert("Ralat AI: " + err.message + "\nSila masukkan odometer secara manual. / AI Error. Please enter odometer manually.");
        } finally {
            setIsAnalyzingOdometer(false);
            if (e.target) e.target.value = '';
        }
    };

    // 6.2 Handle Odometer Confirm & Bind/Unbind Lorry
    const handleOdometerConfirm = async () => {
        if (!scannedLorryData || !odometerPhotoBase64) {
            alert("Sila ambil gambar odometer dahulu! / Please take a photo of the odometer first!");
            return;
        }

        const mileageVal = parseInt(confirmedMileage, 10);
        if (isNaN(mileageVal) || mileageVal <= 0) {
            alert("Sila masukkan bacaan odometer yang sah! / Please enter a valid odometer reading!");
            return;
        }

        setSubmittingOdometer(true);
        try {
            // Add Watermark
            const now = new Date();
            const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                            now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const lines = [
                `Plate: ${scannedLorryData.plate_number}`,
                `Time: ${timeStr} | Type: ODOMETER / MILEAGE`,
                `Driver: ${user.name || user.email}`
            ];
            
            const watermarkedBase64 = await watermarkImage(odometerPhotoBase64, lines);
            
            // Upload to Supabase Storage
            const fileName = `odometer_${scannedLorryData.id}_${Date.now()}.jpg`;
            const blob = dataURLtoBlob(`data:image/jpeg;base64,${watermarkedBase64}`);

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const photoUrl = urlData.publicUrl;

            // Handle BIND / START SHIFT
            if (scannedLorryData.mode === 'bind') {
                // Fetch previous mileage log for discrepancy check
                const { data: lastLog, error: lastLogErr } = await supabase
                    .from('lorry_mileage_logs')
                    .select('mileage')
                    .eq('lorry_id', scannedLorryData.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastLogErr) console.warn("Failed to fetch last mileage log:", lastLogErr);

                if (lastLog && lastLog.mileage !== mileageVal) {
                    // Create discrepancy alert!
                    const diff = mileageVal - lastLog.mileage;
                    const { error: alertErr } = await supabase
                        .from('lorry_mileage_alerts')
                        .insert({
                            lorry_id: scannedLorryData.id,
                            driver_id: user.uid,
                            logged_mileage: mileageVal,
                            expected_mileage: lastLog.mileage,
                            difference: diff,
                            photo_url: photoUrl,
                            resolved: false
                        });

                    if (alertErr) console.error("Failed to create discrepancy alert:", alertErr);
                }

                // Insert new start log
                const { error: logErr } = await supabase
                    .from('lorry_mileage_logs')
                    .insert({
                        lorry_id: scannedLorryData.id,
                        driver_id: user.uid,
                        mileage: mileageVal,
                        photo_url: photoUrl,
                        log_type: 'start'
                    });

                if (logErr) throw logErr;

                // Bind driver to new lorry
                // 1. Unbind driver from any current lorry
                await supabase.from('lorries').update({ driver_id: null, driver_name: null, status: 'Available' }).eq('driver_id', user.uid);
                
                // 2. Bind driver to new lorry
                const { error: bindError } = await supabase.from('lorries')
                    .update({ 
                        driver_id: user.uid, 
                        driver_name: user.name || user.email, 
                        status: 'On-Route' 
                    })
                    .eq('id', scannedLorryData.id);

                if (bindError) throw bindError;

                alert("✅ Lori Berjaya Ditambat! / Lorry Bound Successfully!");
                setIsOdometerModalOpen(false);
                fetchTasks(); // Refresh lorry status
            } 
            // Handle UNBIND / END SHIFT
            else if (scannedLorryData.mode === 'unbind') {
                // Insert ending log
                const { error: logErr } = await supabase
                    .from('lorry_mileage_logs')
                    .insert({
                        lorry_id: scannedLorryData.id,
                        driver_id: user.uid,
                        mileage: mileageVal,
                        photo_url: photoUrl,
                        log_type: 'end'
                    });

                if (logErr) throw logErr;

                // Unbind lorry
                const { error: unbindError } = await supabase.from('lorries')
                    .update({ driver_id: null, driver_name: null, status: 'Available' })
                    .eq('id', scannedLorryData.id);

                if (unbindError) throw unbindError;

                // 取消自动完成 Loaded 订单的逻辑，防止未上传照片的任务被自动改为已送达。
                // 司机如遇照片上传失败，该任务保持 Loaded，由管理人员在后台确认后手动完成。

                alert("✅ Syif Selesai & Lori dilepaskan! / Shift completed & Lorry unbound!");
                setCurrentLorry(null);
                setIsOdometerModalOpen(false);
                fetchTasks(); // Refresh lorry status
            }

        } catch (err: any) {
            alert("Ralat mengesahkan odometer / Error confirming odometer: " + err.message);
        } finally {
            setSubmittingOdometer(false);
        }
    };

    // 7. Unbind Lorry (End Trip)
    // const handleUnbindLorry = async () => {
    //     if (!currentLorry) return;
    //     if (!window.confirm("Tamat Syif dan Lepaskan Lori? / End Shift and Unbind Lorry?")) return;
    //     
    //     try {
    //         setSubmitting(true);
    //         const { error } = await supabase.from('lorries')
    //             .update({ driver_id: null, driver_name: null, status: 'Available' })
    //             .eq('id', currentLorry.id);
    //             
    //         if (error) throw error;
    //         setCurrentLorry(null);
    //         alert("Lori berjaya dilepaskan. / Lorry unbound successfully.");
    //     } catch (err: any) {
    //         alert(err.message);
    //     } finally {
    //         setSubmitting(false);
    //     }
    // };

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
    // For 'Pending Approval' orders: they remain in the Todo list (todoList) until all drops are delivered
    const isPendingApprovalDone = (t: SalesOrder) => {
        if (t.status !== 'Pending Approval') return false;
        // If driver currently has a lorry bound, do not auto-complete/hide Pending Approval orders 
        // to prevent premature completion before the driver ends their shift.
        if (currentLorry) return false;

        if (!t.pod_photo_url || t.pod_photo_url.trim() === '') return false;
        const photoCount = t.pod_photo_url.split(',').length;
        const completedDrops = Math.floor(photoCount / 2);
        const totalDrops = t.trip_drop_count || 1;
        return completedDrops >= totalDrops;
    };

    const todoList = tasks.filter(t => 
        t.status !== 'Delivered' && 
        t.status !== 'Cancelled' && 
        !isPendingApprovalDone(t)
    );
    const doneList = tasks.filter(t => 
        t.status === 'Delivered' || 
        isPendingApprovalDone(t)
    );
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
                            onClick={() => { setScannerMode('unbind'); setIsScannerOpen(true); }}
                            disabled={submitting}
                            className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-300 tracking-wider transition-all disabled:opacity-50"
                        >
                            TAMAT SYIF / END SHIFT
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => { setScannerMode('bind'); setIsScannerOpen(true); }}
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
                                        <h2 className={`text-lg font-black text-white leading-tight whitespace-pre-line ${(order as any).trip_drop_count > 1 ? '' : 'line-clamp-2'}`}>{order.deliveryAddress || order.zone || 'No Route Specified'}</h2>
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
                                    <p className="text-sm text-slate-300 whitespace-pre-line">{order.notes}</p>
                                </div>
                            )}

                            {/* Cargo Preparation Photo */}
                            {(() => {
                                const photos = parsePrepPhotos((order as any).preparation_photo_url);
                                if (photos.length === 0) return null;
                                return (
                                    <div className="mb-4 bg-slate-800/30 p-3 rounded-xl border border-slate-800/80">
                                        <p className="text-[10px] text-amber-500 uppercase font-black mb-2 flex items-center gap-1">📦 Gambar Barang Bersedia / Cargo Prep Photo</p>
                                        <div className={`grid gap-2 max-w-md mx-auto ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {photos.map((p, idx) => (
                                                <div key={idx} className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-video">
                                                    <img 
                                                        src={p.url} 
                                                        alt={`Cargo Prep - ${p.location}`} 
                                                        className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300" 
                                                        onClick={() => setPreviewImageUrl(p.url)}
                                                    />
                                                    <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-[8px] font-black text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                                                        {p.location}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

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


                            {/* POD Photos and Notes (for Delivered orders) */}
                            {order.pod_photo_url && (
                                <div className="mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                                    <p className="text-[10px] text-emerald-400 uppercase font-black mb-2 flex items-center gap-1">📸 Bukti Penghantaran / Proof of Delivery (POD)</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {order.pod_photo_url.split(',').map((url, idx) => {
                                            const isDo = idx % 2 === 0;
                                            if (!url || url.trim() === '') {
                                                if (isDo) {
                                                    const isUploadingThis = laterUploading && 
                                                        laterUploadTarget?.orderId === order.id && 
                                                        laterUploadTarget?.photoIndex === idx;

                                                    return (
                                                        <div key={idx} className="relative rounded-lg border border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all aspect-square flex flex-col items-center justify-center gap-1 group cursor-pointer"
                                                             onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 if (!isUploadingThis) handleTriggerLaterUpload(order.id, idx);
                                                             }}
                                                        >
                                                            {isUploadingThis ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                                    <span className="text-[6px] text-blue-400 font-bold uppercase text-center">UPLOADING...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                                                    <span className="text-[8px] font-black text-slate-400 group-hover:text-slate-200 uppercase tracking-wider text-center px-1">
                                                                        UPLOAD DO
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={idx} className="relative rounded-lg border border-dashed border-slate-800 bg-slate-950/50 aspect-square flex items-center justify-center">
                                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider text-center">NO PHOTO</span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={idx} className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-square group">
                                                    <img 
                                                        src={url} 
                                                        alt={`POD - ${idx + 1}`} 
                                                        className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300" 
                                                        onClick={() => setPreviewImageUrl(url)}
                                                    />
                                                    <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-[8px] font-black text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                                                        {isDo ? 'DO' : 'Barang'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {order.pod_timestamp && (
                                        <p className="text-[9px] text-slate-500 mt-2 font-mono uppercase">
                                            Dihantar pada / Delivered: {new Date(order.pod_timestamp).toLocaleString('en-GB')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ACTION BUTTON (Only for To-Do) */}
                            {activeTab === 'todo' && (
                                (order.status === 'Loaded' || order.status === 'Pending Approval') ? (
                                    <button
                                        onClick={() => handleOpenUnloadModal(order)}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/30 active:scale-95 transition-all"
                                    >
                                        <CheckCircle size={18} /> Sahkan Hantaran / Confirm Delivery
                                        <ChevronRight size={16} className="opacity-50" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleOpenLoadModal(order)}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 active:scale-95 transition-all"
                                    >
                                        <Truck size={18} /> Naik Barang
                                        <ChevronRight size={16} className="opacity-50" />
                                    </button>
                                )
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
                                            <CheckCircle size={14} /> Stok Ditolak & Hantar / Delivered & Stock Deducted
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
                            {/* Cargo Preparation Photo */}
                            {(() => {
                                const photos = parsePrepPhotos((selectedOrder as any).preparation_photo_url);
                                if (photos.length === 0) return null;
                                return (
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 mb-4">
                                        <p className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-1">📦 Rujukan Gambar Bersedia / Cargo Prep Photo</p>
                                        <div className={`grid gap-2 max-w-sm w-full mx-auto ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {photos.map((p, idx) => (
                                                <div key={idx} className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-video">
                                                    <img 
                                                        src={p.url} 
                                                        alt={`Cargo Prep - ${p.location}`} 
                                                        className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300" 
                                                        onClick={() => setPreviewImageUrl(p.url)}
                                                    />
                                                    <div className="absolute top-1 left-1 bg-black/80 backdrop-blur-sm text-[8px] font-black text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
                                                        {p.location}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

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

            {/* UNLOADING MODAL */}
            {isUnloadModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                        <div>
                            <h2 className="font-black text-white text-lg flex items-center gap-1.5">
                                <span>SAHKAN HANTARAN / CONFIRM DELIVERY</span>
                                {selectedOrder.trip_drop_count && selectedOrder.trip_drop_count > 1 && (
                                    <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                                        ({Math.floor((selectedOrder.pod_photo_url ? selectedOrder.pod_photo_url.split(',').length : 0) / 2) + 1}/{selectedOrder.trip_drop_count})
                                    </span>
                                )}
                            </h2>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">{selectedOrder.orderNumber}</p>
                        </div>
                        <button onClick={() => setIsUnloadModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black">
                        {/* GPS Location Panel */}
                        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${fetchingGps ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    📍
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lokasi GPS Semasa / GPS Coordinate</p>
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
                                    1. GAMBAR DO (Delivery Order) {isFinalDrop && <span className="text-[10px] text-amber-500 font-bold lowercase tracking-normal bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">(pilihan / optional)</span>}
                                </label>
                                {unloadDoPhotoBase64 ? (
                                    <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner group">
                                        <img 
                                            src={`data:image/jpeg;base64,${unloadDoPhotoBase64}`} 
                                            alt="DO Photo" 
                                            className="w-full h-full object-cover cursor-zoom-in" 
                                            onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${unloadDoPhotoBase64}`)}
                                        />
                                        <button 
                                            onClick={() => setUnloadDoPhotoBase64(null)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors active:scale-90"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square rounded-xl border border-slate-800 bg-slate-900/30 p-2 flex flex-col items-center justify-center gap-2.5">
                                        {uploadingTarget === 'do' ? (
                                            <>
                                                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-blue-400 font-bold uppercase text-center px-2">Memproses...</span>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        activeFileInputRef.current = 'do';
                                                        unloadCameraInputRef.current?.click();
                                                    }}
                                                    disabled={submitting}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                 >
                                                     <Camera size={14} className="text-emerald-400" />
                                                     📸 Kamera / Camera
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         activeFileInputRef.current = 'do';
                                                         unloadGalleryInputRef.current?.click();
                                                     }}
                                                     disabled={submitting}
                                                     className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                 >
                                                     <span>📁</span>
                                                     <span>Galeri / Gallery</span>
                                                 </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Product Photo Slot */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                    2. GAMBAR BARANG (PRODUK) {isFinalDrop && <span className="text-[10px] text-amber-500 font-bold lowercase tracking-normal bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">(pilihan / optional)</span>}
                                </label>
                                {unloadProductPhotoBase64 ? (
                                    <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner group">
                                        <img 
                                            src={`data:image/jpeg;base64,${unloadProductPhotoBase64}`} 
                                            alt="Product Photo" 
                                            className="w-full h-full object-cover cursor-zoom-in" 
                                            onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${unloadProductPhotoBase64}`)}
                                        />
                                        <button 
                                            onClick={() => setUnloadProductPhotoBase64(null)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors active:scale-90"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full aspect-square rounded-xl border border-slate-800 bg-slate-900/30 p-2 flex flex-col items-center justify-center gap-2.5">
                                        {uploadingTarget === 'product' ? (
                                            <>
                                                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                                <span className="text-[10px] text-blue-400 font-bold uppercase text-center px-2">Memproses...</span>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        activeFileInputRef.current = 'product';
                                                        unloadCameraInputRef.current?.click();
                                                    }}
                                                    disabled={submitting}
                                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                 >
                                                     <Camera size={14} className="text-emerald-400" />
                                                     📸 Kamera / Camera
                                                 </button>
                                                 <button
                                                     type="button"
                                                     onClick={() => {
                                                         activeFileInputRef.current = 'product';
                                                         unloadGalleryInputRef.current?.click();
                                                     }}
                                                     disabled={submitting}
                                                     className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                                                 >
                                                     <span>📁</span>
                                                     <span>Galeri / Gallery</span>
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
                                3. REMARK / CATATAN PENGHANTARAN
                            </label>
                            <textarea
                                value={deliveryNote}
                                onChange={e => setDeliveryNote(e.target.value)}
                                placeholder="Tuliskan nota penghantaran di sini (contoh: Barang diletakkan di pondok pengawal, ditandatangani oleh En. Lee)"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-24 text-sm transition-all"
                            />
                        </div>

                        {/* Previously Uploaded Photos */}
                        {selectedOrder.pod_photo_url && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                                    GAMBAR HANTARAN TERDAHULU / PREVIOUSLY UPLOADED PHOTOS
                                </label>
                                <div className="grid grid-cols-4 gap-2 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                                    {selectedOrder.pod_photo_url.split(',').map((url, idx) => (
                                        <div key={idx} className="relative rounded-lg overflow-hidden border border-white/5 bg-black/40 aspect-square">
                                            <img 
                                                src={url} 
                                                alt={`POD - ${idx + 1}`} 
                                                className="w-full h-full object-cover cursor-zoom-in" 
                                                onClick={() => setPreviewImageUrl(url)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Final Drop Toggle Checkbox */}
                        {/* Final Drop Toggle Checkbox (Hidden: Trip completion handled by office scan QR) */}
                        {false && (
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-white uppercase">HANTARAN TERAKHIR (TAMAT TRIP)? / FINAL DROP (END TRIP)?</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-medium">
                                        Tandakan ini jika semua drop point / destinasi untuk trip ini telah selesai.
                                    </p>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={isFinalDrop}
                                    onChange={(e) => setIsFinalDrop(e.target.checked)}
                                    className="w-6 h-6 rounded-lg bg-black border border-slate-700 accent-blue-600 outline-none cursor-pointer"
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3 safe-bottom-padding">
                        <button
                            onClick={handleConfirmUnload}
                            disabled={submitting || uploadingTarget !== null || (!isFinalDrop && !unloadProductPhotoBase64)}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-emerald-950/40 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>PENGHANTARAN SEDANG DIHANTAR... / CONFIRMING...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    <span>
                                        {isFinalDrop 
                                            ? "HANTAR & TAMAT TRIP / SUBMIT & END TRIP" 
                                            : "HANTAR DROP POINT INI / SUBMIT THIS DROP POINT"
                                        }
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

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
                                    <img 
                                        src={`data:image/jpeg;base64,${loadPhotoBase64}`} 
                                        alt="Pick Up" 
                                        className="w-full h-48 object-cover cursor-zoom-in" 
                                        onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${loadPhotoBase64}`)}
                                    />
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
                        <h2 className="font-black text-white text-lg flex items-center gap-2">
                            <QrCode size={20} className="text-blue-500" />
                            {scannerMode === 'bind' 
                                ? "IMBAS QR LORI / SCAN LORRY QR" 
                                : "IMBAS QR LORI (PEMULANGAN) / SCAN LORRY QR (RETURN VEHICLE)"
                            }
                        </h2>
                        <button onClick={() => setTimeout(() => setIsScannerOpen(false), 100)} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
                        <div className="w-full max-w-sm aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-4 border-slate-800 relative shadow-2xl">
                            {submitting ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-blue-400 gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    <span className="font-black tracking-widest text-xs uppercase">
                                        {scannerMode === 'bind' 
                                            ? "Menghubungkan... / Binding..." 
                                            : "Memproses... / Processing..."
                                        }
                                    </span>
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
                            {scannerMode === 'bind'
                                ? "Halakan kamera anda ke kod QR di papan pemuka lori untuk mendaftar syif anda. / Point your camera at the QR code on the lorry dashboard to bind your shift."
                                : "Halakan kamera anda ke kod QR lori anda semula untuk mengesahkan pemulangan lori & tamatkan trip. / Point your camera at your lorry QR code again to confirm return & end trip."
                            }
                        </p>
                    </div>
                </div>
            )}

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

            {/* Hidden inputs for image uploads at root level so they are always in the DOM */}
            <input
                ref={unloadCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUnloadPhotoSelect}
            />
            <input
                ref={unloadGalleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUnloadPhotoSelect}
            />
            <input
                ref={laterFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLaterFileSelect}
            />
            <input
                ref={odometerCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleOdometerPhotoSelect}
            />

            {/* ODOMETER PHOTO VERIFICATION MODAL */}
            {isOdometerModalOpen && scannedLorryData && (
                <div className="fixed inset-0 z-[300] bg-slate-950/95 flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-[#1a1a1f] border border-slate-800 w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 my-auto">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                            <div>
                                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                                    <Truck className="text-blue-500 animate-pulse" />
                                    BACAAN ODOMETER / ODOMETER READING
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    {scannedLorryData.mode === 'bind' ? 'Mula Syif (Start Shift)' : 'Tamat Syif (End Shift)'} | Plate: <span className="text-blue-400">{scannedLorryData.plate_number}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm("Batal? / Cancel?")) {
                                        setIsOdometerModalOpen(false);
                                        setScannedLorryData(null);
                                    }
                                }}
                                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Guide / Instruction */}
                        {!odometerPhotoBase64 && (
                            <div className="space-y-4">
                                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Panduan Mengambil Gambar / Photo Guide:</h4>
                                    <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                                        <li>Ambil gambar meter ODO di papan pemuka lori / Take photo of the ODO meter on the dashboard.</li>
                                        <li>Pastikan nombor ODO kelihatan jelas dan tidak silau / Ensure ODO numbers are clearly visible and glare-free.</li>
                                        <li>Lihat contoh di bawah / Refer to the example below.</li>
                                    </ul>
                                </div>
                                
                                {/* Example Image Box */}
                                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 relative group overflow-hidden">
                                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-blue-600/90 text-white text-[9px] font-black uppercase rounded tracking-wider">
                                        Contoh / Example
                                    </div>
                                    <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
                                        <img 
                                            src="/odometer_example.jpg" 
                                            alt="Odometer Example" 
                                            className="w-full h-full object-cover opacity-80" 
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/40">
                                            <Camera size={32} className="text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">ODO Display must be legible</span>
                                            <span className="text-[8px] text-slate-500 font-bold uppercase mt-1">(e.g., ODO 95671 km)</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => odometerCameraInputRef.current?.click()}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-950/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Camera size={18} />
                                    AMBIL FOTO ODOMETER / TAKE ODO PHOTO
                                </button>
                            </div>
                        )}

                        {/* Image Preview & AI Analysis */}
                        {odometerPhotoBase64 && (
                            <div className="space-y-6">
                                <div className="relative aspect-[16/10] w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center shadow-inner">
                                    <img 
                                        src={`data:image/jpeg;base64,${odometerPhotoBase64}`} 
                                        alt="Odometer Capture" 
                                        className="w-full h-full object-cover"
                                    />
                                    
                                    {isAnalyzingOdometer && (
                                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                                            <p className="text-sm font-bold text-white uppercase tracking-wider">AI Menganalisis Foto... / AI Analyzing ODO...</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Sila tunggu sebentar / Please wait a moment</p>
                                        </div>
                                    )}
                                </div>

                                {!isAnalyzingOdometer && (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                                            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">
                                                Masukkan Bacaan ODO (km) / Confirm ODO Value:
                                            </label>
                                            
                                            <div className="relative flex items-center">
                                                <input 
                                                    type="number"
                                                    pattern="[0-9]*"
                                                    inputMode="numeric"
                                                    placeholder="Contoh: 95671"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white text-lg font-mono font-bold focus:border-blue-500 outline-none text-center tracking-widest"
                                                    value={confirmedMileage}
                                                    onChange={(e) => setConfirmedMileage(e.target.value)}
                                                />
                                                <span className="absolute right-4 text-xs font-black text-slate-500 uppercase">KM</span>
                                            </div>

                                            {detectedMileage !== null ? (
                                                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/15 py-2 px-3 rounded-lg">
                                                    <CheckCircle size={12} />
                                                    <span>AI berjaya mengesan bacaan ODO: {detectedMileage} km</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-[10px] text-amber-400 font-bold bg-amber-500/5 border border-amber-500/15 py-2 px-3 rounded-lg">
                                                    <span>⚠️ Sila masukkan bacaan ODO secara manual jika AI tidak mengesan dengan tepat.</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => odometerCameraInputRef.current?.click()}
                                                disabled={submittingOdometer}
                                                className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                                            >
                                                Ambil Semula / Retake
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleOdometerConfirm}
                                                disabled={submittingOdometer || isAnalyzingOdometer}
                                                className="flex-2 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-950/50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                            >
                                                {submittingOdometer ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                        <span>Menghantar... / Submitting...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle size={14} />
                                                        <span>Sah & Simpan / Confirm & Save</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div >
    );
};

export default DriverDelivery;
