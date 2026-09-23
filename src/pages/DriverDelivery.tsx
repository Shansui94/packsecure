import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Truck, CheckCircle, Package, ChevronRight, ChevronDown, ChevronUp, X, RefreshCw, Camera, Image as ImageIcon, QrCode, Upload, Phone, MapPin, ExternalLink, MessageCircle } from 'lucide-react';
import { SalesOrder } from '../types';
import { Scanner } from '@yudiel/react-qr-scanner';
import { parsePrepPhotos } from '../utils/prepPhotos';
import { dataURLtoBlob } from '../utils/imageCompress';
import { deductStockForOrder } from '../services/stockService';
import { logActivity } from '../utils/logger';
import DriverTutorialModal from '../components/DriverTutorialModal';

interface DriverDeliveryProps {
    user: any;
    onNavigate?: (page: string) => void;
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

export const countCompletedDrops = (podPhotoUrl?: string | null): number => {
    if (!podPhotoUrl || !podPhotoUrl.trim()) return 0;
    const rawPhotos = podPhotoUrl.split(',');
    let count = 0;
    for (let i = 0; i < rawPhotos.length; i += 2) {
        if ((rawPhotos[i] && rawPhotos[i].trim()) || (rawPhotos[i + 1] && rawPhotos[i + 1].trim())) {
            count++;
        }
    }
    return count;
};

// Helper to extract trip number or tag from order notes
export const extractTripIdentifier = (notes?: string | null): { tripSeq?: number; tripTag?: string } => {
    if (!notes) return {};
    const lower = notes.toLowerCase();

    // 1. Check bracket format: [Trip: trip 2 malam hantar]
    const mBracket = notes.match(/\[Trip:\s*([^\]]+)\]/i);
    if (mBracket) {
        const content = mBracket[1].trim();
        const numMatch = content.match(/\b(\d+)\b/);
        if (numMatch) {
            return { tripSeq: parseInt(numMatch[1], 10), tripTag: `Trip ${numMatch[1]}` };
        }
        return { tripTag: content };
    }

    // 2. Check "trip 1", "trip 2", "trip 3"
    const mTrip = lower.match(/\btrip\s*(\d+)\b/);
    if (mTrip) {
        return { tripSeq: parseInt(mTrip[1], 10), tripTag: `Trip ${mTrip[1]}` };
    }

    // 3. Check "1p", "2p", "3p" (Malaysian pusingan / trip shorthand)
    const mP = lower.match(/\b(\d+)\s*p\b/);
    if (mP) {
        return { tripSeq: parseInt(mP[1], 10), tripTag: `Trip ${mP[1]}` };
    }

    return {};
};

const DriverDelivery: React.FC<DriverDeliveryProps> = ({ user, onNavigate }) => {
    // State
    const [tasks, setTasks] = useState<SalesOrder[]>([]);
    const [tripsV2List, setTripsV2List] = useState<any[]>([]);
    const [expandedTripKeys, setExpandedTripKeys] = useState<Record<string, boolean>>({});
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');

    // 📡 网页端原生 HTML5 地理定位实时同步 (Web App Realtime Location)
    const [webGpsActive, setWebGpsActive] = useState<boolean>(true);
    const [webGpsStatus, setWebGpsStatus] = useState<string>('正在获取网页端 GPS 定位...');
    const lastGpsUploadTimeRef = useRef<number>(0);
    const lastGpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!user?.uid || !webGpsActive || !navigator.geolocation) return;

        console.log('[Web GPS] 开启网页端 HTML5 定位监听...');

        const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const { latitude, longitude, speed, heading } = pos.coords;
                setWebGpsStatus(`● Web 实时定位: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

                const now = Date.now();
                const timeDiffSeconds = (now - lastGpsUploadTimeRef.current) / 1000;
                let distanceMovedMeters = 0;
                if (lastGpsCoordsRef.current) {
                    distanceMovedMeters = calculateDistanceKm(
                        lastGpsCoordsRef.current.lat,
                        lastGpsCoordsRef.current.lng,
                        latitude,
                        longitude
                    ) * 1000;
                }

                // 节流机制：至少间隔 20 秒，或位移超过 50 米且间隔 >= 10 秒才上报
                const shouldUpload = !lastGpsCoordsRef.current || timeDiffSeconds >= 20 || (distanceMovedMeters >= 50 && timeDiffSeconds >= 10);

                if (shouldUpload) {
                    lastGpsUploadTimeRef.current = now;
                    lastGpsCoordsRef.current = { lat: latitude, lng: longitude };

                    try {
                        await supabase.from('driver_locations').upsert({
                            driver_id: user.uid,
                            latitude,
                            longitude,
                            speed: speed || 0,
                            heading: heading || 0,
                            updated_at: new Date().toISOString(),
                        });
                    } catch (err) {
                        console.warn('[Web GPS] 上报 Supabase 失败 (可忽略网络抖动):', err);
                    }
                }
            },
            (err) => {
                console.warn('[Web GPS] 位置获取失败:', err.message);
                setWebGpsStatus('⚠️ 请在浏览器中允许定位权限以开启实时跟踪');
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 15000,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [user?.uid, webGpsActive]);
    
    // Lorry Binding State
    const [currentLorry, setCurrentLorry] = useState<any>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerMode, setScannerMode] = useState<'bind' | 'unbind'>('bind');
    const hasScannedRef = useRef(false);
    const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);

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
    const [selectedTripForLoad, setSelectedTripForLoad] = useState<any | null>(null);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [loadItems, setLoadItems] = useState<any[]>([]); // Items to verify
    const [submitting, setSubmitting] = useState(false);
    const [loadPhotoBase64, setLoadPhotoBase64] = useState<string | null>(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PICK UP / EXTRA JOB State
    const [isPickUpModalOpen, setIsPickUpModalOpen] = useState(false);
    const [pickUpCategory, setPickUpCategory] = useState<string>('AMBIK PALLET');
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);
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
    const laterUploadTargetRef = useRef<{ orderId: string, photoIndex: number } | null>(null);
    const [laterUploading, setLaterUploading] = useState(false);
    const laterFileInputRef = useRef<HTMLInputElement>(null);

    // Helpers to check order delivery status (multi-drop aware: 1 DO = 1 drop)
    const isPendingApprovalDone = (t: SalesOrder, isMultiOrderTrip: boolean = false) => {
        if (t.status !== 'Pending Approval') return false;
        // If it's an Extra Job or Pick Up, it has already been submitted with photo proof and is only awaiting Admin approval.
        const isExtra = (t as any).job_type === 'Extra Job' || (t as any).job_type === 'Pick Up' || t.orderNumber?.startsWith('TRIP-JOB') || t.orderNumber?.startsWith('TRIP-PU') || (!t.items || t.items.length === 0);
        if (isExtra) return true;

        const totalDrops = isMultiOrderTrip ? 1 : Math.max(1, Number((t as any).trip_drop_count) || 1);
        const completedDrops = countCompletedDrops(t.pod_photo_url);
        return completedDrops >= totalDrops || Boolean(t.notes && t.notes.includes('Proof uploaded'));
    };

    const isOrderFullyDelivered = (order: SalesOrder, isMultiOrderTrip: boolean = false) => {
        if (order.status === 'Delivered') return true;
        if (order.status === 'Cancelled') return true;
        if (order.status === 'Pending Approval') return isPendingApprovalDone(order, isMultiOrderTrip);

        if (order.status === 'Loaded') {
            const totalDrops = isMultiOrderTrip ? 1 : Math.max(1, Number((order as any).trip_drop_count) || 1);
            const completedDrops = countCompletedDrops(order.pod_photo_url);
            return completedDrops >= totalDrops;
        }

        return false;
    };

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
                // Fetch related trips_v2 for accurate trip numbers & metadata
                const tripIds = Array.from(new Set(data.map((item: any) => item.trip_id).filter(Boolean)));
                const tripsV2Acc: any[] = [];
                if (tripIds.length > 0) {
                    try {
                        const { data: tripsData } = await supabase
                            .from('trips_v2')
                            .select('*')
                            .in('id', tripIds);
                        if (tripsData) {
                            tripsV2Acc.push(...tripsData);
                        }
                    } catch (tErr) {
                        console.warn("trips_v2 fetch warning:", tErr);
                    }
                }
                try {
                    const { data: driverTrips } = await supabase
                        .from('trips_v2')
                        .select('*')
                        .eq('driver_id', user.uid);
                    if (driverTrips) {
                        driverTrips.forEach(dt => {
                            if (!tripsV2Acc.some(t => t.id === dt.id)) {
                                tripsV2Acc.push(dt);
                            }
                        });
                    }
                } catch (dtErr) {
                    console.warn("driver trips_v2 direct fetch notice:", dtErr);
                }
                setTripsV2List(tripsV2Acc);

                // Map DB snake_case to TS camelCase
                const mapped = data.map((item: any) => ({
                    ...item,
                    orderNumber: item.order_number || item.orderNumber,
                    deliveryAddress: item.delivery_address || item.deliveryAddress,
                    zone: item.zone || item.delivery_zone,
                    deliveryDate: item.deadline, // Use Deadline as Delivery Date
                    orderDate: item.order_date || item.orderDate, // Map date
                    customer_phone: item.customer_phone || item.customerPhone,
                    stop_sequence: item.stop_sequence ?? item.stopSequence,
                    terms: item.terms,
                    do_total: item.do_total
                }));

                // Client-side sort
                const sorted = mapped.sort((a: any, b: any) => {
                    // 1. Get the logical sequence (prioritize trip_sequence, fallback to stop_sequence if valid)
                    const getSeq = (o: any) => {
                        if (o.trip_sequence !== undefined && o.trip_sequence !== null && o.trip_sequence !== 999) {
                            return o.trip_sequence;
                        }
                        if (o.tripSequence !== undefined && o.tripSequence !== null && o.tripSequence !== 999) {
                            return o.tripSequence;
                        }
                        if (o.stop_sequence !== undefined && o.stop_sequence !== null && o.stop_sequence !== 999) {
                            return o.stop_sequence;
                        }
                        return 999;
                    };

                    const seqA = getSeq(a);
                    const seqB = getSeq(b);
                    if (seqA !== seqB) {
                        return seqA - seqB;
                    }

                    // 2. If sequence is same, sort by created_at descending (newest first, matches DOM line 585 logic)
                    const timeA = a.created_at || '';
                    const timeB = b.created_at || '';
                    if (timeA !== timeB) {
                        return timeB.localeCompare(timeA);
                    }

                    // 3. Fallback to order number descending if created_at is also empty
                    const numA = a.orderNumber || a.order_number || '';
                    const numB = b.orderNumber || b.order_number || '';
                    return String(numB || '').localeCompare(String(numA || ''));
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
        supabase.from('delivery_rates').select('*').then(({ data }) => {
            if (data) setDeliveryRates(data);
        });
    }, [user]);


    // 2. Open Load Modal (Single DO fallback)
    const handleOpenLoadModal = (order: SalesOrder) => {
        setSelectedTripForLoad(null);
        setSelectedOrder(order);
        // Deep copy items to allow editing quantity if needed (default same qty)
        setLoadItems(order.items?.map(i => ({ 
            ...i, 
            orderId: order.id,
            orderNumber: order.orderNumber,
            customer: order.customer,
            confirmedQty: i.quantity 
        })) || []);
        setIsLoadModalOpen(true);
    };

    // 2b. Open Trip Load Modal (Batch load all orders in trip with 1 Naik Barang)
    const handleOpenTripLoadModal = (trip: any) => {
        setSelectedTripForLoad(trip);
        setSelectedOrder(trip.orders?.[0] || null);
        const allItems: any[] = [];
        (trip.orders || []).forEach((ord: any) => {
            (ord.items || []).forEach((it: any) => {
                allItems.push({
                    ...it,
                    orderId: ord.id,
                    orderNumber: ord.orderNumber,
                    customer: ord.customer,
                    confirmedQty: it.quantity
                });
            });
        });
        setLoadItems(allItems);
        setIsLoadModalOpen(true);
    };

    // 3. Submit Loading (Deduct Stock / Confirm Naik Barang for Trip or DO)
    const handleConfirmLoad = async (photoBase64Str?: string) => {
        if (!selectedOrder && !selectedTripForLoad) return;
        const finalPhoto = photoBase64Str || loadPhotoBase64;
        if (!finalPhoto) {
            alert("⚠️ Sila ambil gambar barangan yang dimuatkan dahulu! / Please take a photo of the loaded goods first!");
            return;
        }

        setSubmitting(true);
        let photoUrl = '';

        try {
            // Upload Photo First
            const targetName = selectedTripForLoad 
                ? `trip_${selectedTripForLoad.tripNumber || 'batch'}` 
                : (selectedOrder?.orderNumber || 'order');

            try {
                const fileName = `load_${targetName}_${Date.now()}.jpg`;
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

            const ordersToUpdate: SalesOrder[] = selectedTripForLoad 
                ? (selectedTripForLoad.orders || []) 
                : (selectedOrder ? [selectedOrder] : []);

            let anyOrderAmended = false;

            for (const order of ordersToUpdate) {
                // Check for Amendments in this order's items
                const orderLoadItems = loadItems.filter(li => !li.orderId || li.orderId === order.id);
                const hasAmendments = orderLoadItems.some(item => item.confirmedQty !== undefined && item.confirmedQty !== item.quantity);

                if (hasAmendments) {
                    anyOrderAmended = true;
                    const updatedItems = order.items?.map(original => {
                        const match = orderLoadItems.find(li => li.sku === original.sku && li.remark === original.remark);
                        return {
                            ...original,
                            quantity: match?.confirmedQty ?? original.quantity,
                            original_quantity: original.quantity
                        };
                    });

                    await supabase.from('sales_orders').update({
                        status: 'Pending Approval',
                        items: updatedItems,
                        notes: (order.notes || '') + ` | Amended by Driver: ${user?.name}`,
                        proof_of_load_url: photoUrl
                    }).eq('id', order.id);
                } else {
                    const { error: updateError } = await supabase.from('sales_orders').update({
                        status: 'Loaded',
                        proof_of_load_url: photoUrl
                    }).eq('id', order.id);

                    if (updateError) console.error("Error loading order:", order.id, updateError);
                }
            }

            // Sync trips_v2 status if applicable
            if (selectedTripForLoad?.tripId) {
                try {
                    await supabase.from('trips_v2').update({
                        status: 'In Transit',
                        started_at: new Date().toISOString()
                    }).eq('id', selectedTripForLoad.tripId);
                } catch (tripErr) {
                    console.warn("trips_v2 sync warning:", tripErr);
                }
            }

            // Optimistic Update: Move orders to Loaded (or Pending Approval) locally
            const orderIdsSet = new Set(ordersToUpdate.map(o => o.id));
            setTasks(prev => prev.map(t => {
                if (orderIdsSet.has(t.id)) {
                    const orderLoadItems = loadItems.filter(li => !li.orderId || li.orderId === t.id);
                    const hasAmendments = orderLoadItems.some(item => item.confirmedQty !== undefined && item.confirmedQty !== item.quantity);
                    if (hasAmendments) {
                        const updatedItems = t.items?.map(original => {
                            const match = orderLoadItems.find(li => li.sku === original.sku && li.remark === original.remark);
                            return {
                                ...original,
                                quantity: match?.confirmedQty ?? original.quantity,
                                original_quantity: original.quantity
                            };
                        });
                        return {
                            ...t,
                            status: 'Pending Approval',
                            items: updatedItems,
                            proof_of_load_url: photoUrl
                        };
                    } else {
                        return {
                            ...t,
                            status: 'Loaded',
                            proof_of_load_url: photoUrl
                        };
                    }
                }
                return t;
            }));

            if (anyOrderAmended) {
                alert("⚠️ Kuantiti pesanan berubah & Menunggu kelulusan logistik. / Order quantity changed & Pending logistics approval.");
            } else {
                alert("✅ Muatan berjaya disahkan! / Cargo loading confirmed successfully!");
            }

            setIsLoadModalOpen(false);
            setLoadPhotoBase64(null);
            setSelectedTripForLoad(null);

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

    // 5. Submit Ad-Hoc Extra Job / Pick Up
    const handleConfirmPickUp = async () => {
        if (!loadPhotoBase64) {
            alert("⚠️ Sila ambil gambar bukti tugasan dahulu! / Please take a photo of the task proof first!");
            return;
        }
        
        setSubmitting(true);
        try {
            // Upload Photo
            const fileName = `extrajob_${user?.employeeId}_${Date.now()}.jpg`;
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

            // Generate an order number for this ad-hoc extra job
            const pickupOrderNo = `TRIP-JOB-${Date.now().toString().slice(-6)}`;
            const driverOrigin = (currentLorry?.factory_id || user?.base_location || 'TAIPING').toUpperCase();

            const payload = {
                order_number: pickupOrderNo,
                driver_id: user?.uid,
                customer: `[${pickUpCategory}] ${user?.name || 'Driver'}`,
                job_type: 'Extra Job',
                zone: pickUpCategory,
                trip_origin: driverOrigin,
                notes: pickUpNote ? `[${pickUpCategory}] ${pickUpNote}` : `[${pickUpCategory}]`,
                proof_of_load_url: photoUrl,
                delivery_address: pickupLocation,
                deadline: new Date().toISOString().split('T')[0],
                order_date: new Date().toISOString().split('T')[0],
                status: 'Pending Approval',
                trip_drop_count: 1,
                delivery_method: 'Company Delivery',
                items: []
            };

            const { data: insertedRecord, error: insertError } = await supabase
                .from('sales_orders')
                .insert(payload)
                .select()
                .single();

            if (insertError) {
                console.warn("Direct insert failed, using RPC fallback:", insertError);
                await supabase.rpc('create_driver_pickup_safe', {
                    p_order_number: pickupOrderNo,
                    p_driver_id: user?.uid,
                    p_notes: `[${pickUpCategory}] ${pickUpNote}`,
                    p_photo_url: photoUrl,
                    p_location: pickupLocation
                });
            }

            // Optimistic update
            if (insertedRecord) {
                const newOrderRecord = insertedRecord as any;
                const mapped = {
                    ...newOrderRecord,
                    orderNumber: newOrderRecord.order_number,
                    deliveryAddress: newOrderRecord.delivery_address,
                    zone: newOrderRecord.zone,
                    deliveryDate: newOrderRecord.deadline,
                };
                setTasks(prev => [mapped, ...prev]);
            } else {
                fetchTasks();
            }

            // Reset and close
            setIsPickUpModalOpen(false);
            setLoadPhotoBase64(null);
            setPickUpNote('');
            alert("✅ Tugasan berjaya direkodkan! Sedang menunggu kelulusan Admin. / Extra job recorded! Awaiting Admin approval.");
        } catch (e: any) {
            alert("Error saving extra job: " + e.message);
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const response = await fetch('/api/agent/ai-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageBase64: base64Str, mode: 'do' }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.do_number || '';
        } catch (err) {
            console.warn("AI DO extraction timed out or failed (non-fatal):", err);
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
            const newPair = [doUrl || '', prodUrl || ''];
            const rawPod = selectedOrder.pod_photo_url ? selectedOrder.pod_photo_url.trim() : '';
            const existingPhotos = rawPod ? rawPod.split(',') : [];
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

            // Multi-drop aware: Always fetch freshest trip_drop_count from DB to prevent stale client state
            let freshTripDropCount = (selectedOrder as any).trip_drop_count;
            try {
                const { data: freshOrder } = await supabase
                    .from('sales_orders')
                    .select('trip_drop_count')
                    .eq('id', selectedOrder.id)
                    .single();
                if (freshOrder?.trip_drop_count) {
                    freshTripDropCount = freshOrder.trip_drop_count;
                }
            } catch (fetchErr) {
                console.warn('[handleConfirmUnload] Fresh trip_drop_count check notice:', fetchErr);
            }

            // If the order has multiple drops (trip_drop_count > 1), keep status 'Loaded' until all drops are submitted
            const totalDrops = Math.max(1, Number(freshTripDropCount) || 1);
            const completedDrops = countCompletedDrops(podPhotoUrl);

            // Safety guard: if driver marked isFinalDrop before all drops are finished, prompt confirmation
            if (isFinalDrop && completedDrops < totalDrops) {
                const confirmEarly = window.confirm(
                    `⚠️ AMARAN: Anda baru menyelesaikan ${completedDrops}/${totalDrops} hentian.\nAdakah anda pasti baki ${totalDrops - completedDrops} hentian dibatalkan dan trip ini tamat lebih awal?`
                );
                if (!confirmEarly) {
                    setIsFinalDrop(false);
                    setSubmitting(false);
                    return;
                }
            }

            const isAllDropsCompleted = isFinalDrop || completedDrops >= totalDrops;

            let nextStatus = selectedOrder.status === 'Pending Approval' 
                ? 'Pending Approval' 
                : (isAllDropsCompleted ? 'Delivered' : 'Loaded');

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

            // Update order status, set pod_photo_url, pod_timestamp, notes, etc.
            const { data: updatedData, error: updateError } = await supabase.from('sales_orders').update(updatePayload).eq('id', selectedOrder.id).select();

            if (updateError) throw updateError;
            if (!updatedData || updatedData.length === 0) {
                throw new Error("Update failed: Permission denied or Order not found. (RLS Check Failed)");
            }

            // Sync to trip_stops_v2 and trips_v2 if this order belongs to a trips_v2 trip
            if ((selectedOrder as any).trip_id) {
                try {
                    await supabase
                        .from('trip_stops_v2')
                        .update({
                            status: isFinalDrop ? 'Completed' : 'Delivered',
                            completed_at: new Date().toISOString(),
                            pod_photos: [doUrl, prodUrl].filter(Boolean),
                            pod_notes: deliveryNote || null
                        })
                        .eq('sales_order_id', selectedOrder.id);

                    // Check if all sibling stops of this trip are completed/delivered
                    const { data: siblingStops } = await supabase
                        .from('trip_stops_v2')
                        .select('id, status')
                        .eq('trip_id', (selectedOrder as any).trip_id);

                    const allStopsDone = siblingStops && siblingStops.length > 0 && siblingStops.every(s => s.status === 'Delivered' || s.status === 'Completed');
                    if (isFinalDrop || allStopsDone) {
                        await supabase
                            .from('trips_v2')
                            .update({
                                status: 'Completed',
                                completed_at: new Date().toISOString()
                            })
                            .eq('id', (selectedOrder as any).trip_id);
                    }
                } catch (syncErr) {
                    console.warn('[TripSync] Non-critical trip_stops_v2 sync warning:', syncErr);
                }
            }

            // Optimistic Update locally
            setTasks(prev => prev.map(t => {
                if (t.id === selectedOrder.id) {
                    const localUpdated: any = { 
                        ...t, 
                        status: nextStatus, 
                        trip_drop_count: totalDrops,
                        pod_photo_url: podPhotoUrl, 
                        pod_timestamp: new Date().toISOString(), 
                        notes: updatedNotes 
                    };
                    return localUpdated;
                }
                return t;
            }));

            // Fetch fresh tasks in background to ensure all properties and related trips are aligned
            fetchTasks();

            setIsUnloadModalOpen(false);
            setUnloadDoPhotoBase64(null);
            setUnloadProductPhotoBase64(null);
            setDeliveryNote('');

            // Extract structured photos, GPS and items
            const proofPhotos = [doUrl, prodUrl].filter(Boolean);
            const orderItems = (selectedOrder.items || []).map((i: any) => ({
                sku: i.sku || 'N/A',
                name: i.product || i.name || '商品',
                quantity: i.quantity,
                confirmedQty: i.confirmedQty ?? i.quantity,
                unit: i.uom || '件'
            }));
            const totalQty = orderItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

            // Log successful delivery action with high precision 5W1H
            logActivity(user, {
                action: isFinalDrop ? 'DRIVER_COMPLETE_TRIP' : 'DRIVER_CONFIRM_DROP_POINT',
                module: 'Logistics / DriverDelivery',
                target: `Order #${selectedOrder.orderNumber || selectedOrder.id}`,
                status: 'SUCCESS',
                resultSummary: isFinalDrop 
                    ? `司机完成并结束整个送货行程 (#${selectedOrder.orderNumber || ''})` 
                    : `司机成功提交送货点签收 (#${selectedOrder.orderNumber || ''} - 客户: ${selectedOrder.customer || '客户'}, 共 ${orderItems.length} 项 / ${totalQty} 件)`,
                location: (selectedOrder as any).destination || selectedOrder.customer,
                details: {
                    orderId: selectedOrder.id,
                    orderNumber: selectedOrder.orderNumber,
                    customer: selectedOrder.customer,
                    destination: (selectedOrder as any).destination,
                    isFinalDrop,
                    photos: proofPhotos,
                    photoUrl: prodUrl || doUrl || null,
                    doUrl: doUrl || null,
                    prodUrl: prodUrl || null,
                    gps: gpsCoordinates && !gpsCoordinates.includes('Fetching') ? gpsCoordinates : null,
                    items: orderItems,
                    totalQuantity: totalQty,
                    lorry_plate: currentLorry?.plate_number || undefined,
                    extractedDoNumber: extractedDoNumber || null,
                    note: deliveryNote || null
                }
            });

            if (isAllDropsCompleted) {
                alert(`✅ Trip selesai sepenuhnya (${completedDrops}/${totalDrops} Drops)! / Trip completed fully!`);
            } else {
                alert(`✅ Drop ${completedDrops}/${totalDrops} disimpan! Sila teruskan ke drop point seterusnya.\n\nDrop ${completedDrops}/${totalDrops} saved! Please proceed to the next stop.`);
            }
        } catch (err: any) {
            logActivity(user, {
                action: 'DRIVER_CONFIRM_DROP_POINT_FAILED',
                module: 'Logistics / DriverDelivery',
                target: `Order #${selectedOrder?.orderNumber || selectedOrder?.id || ''}`,
                status: 'FAILED',
                resultSummary: `送货签收失败: ${err.message}`,
                details: {
                    orderId: selectedOrder?.id,
                    error: err.message
                }
            });
            alert("Ralat mengesahkan penghantaran / Error confirming delivery: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleTriggerLaterUpload = (orderId: string, idx: number) => {
        laterUploadTargetRef.current = { orderId, photoIndex: idx };
        setLaterUploadTarget({ orderId, photoIndex: idx });
        laterFileInputRef.current?.click();
    };

    const handleLaterFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const target = laterUploadTargetRef.current || laterUploadTarget;
        if (!file || !target) return;

        setLaterUploading(true);
        try {
            // Compress image
            const compressedBase64 = await compressImage(file);
            const base64Only = compressedBase64.split(',')[1];

            // Load order details to get orderNumber (needed for fileName)
            const targetOrder = tasks.find(t => t.id === target.orderId);
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

            // Fetch the current pod_photo_url, status, and trip_drop_count from database to be accurate
            const { data: freshOrder, error: fetchErr } = await supabase
                .from('sales_orders')
                .select('status, trip_drop_count, pod_photo_url, notes')
                .eq('id', target.orderId)
                .single();

            if (fetchErr) throw fetchErr;

            const currentPhotos = freshOrder.pod_photo_url ? freshOrder.pod_photo_url.split(',') : [];
            
            // Expand or replace at photoIndex
            while (currentPhotos.length <= target.photoIndex) {
                currentPhotos.push('');
            }
            currentPhotos[target.photoIndex] = publicUrl;
            const updatedPodUrl = currentPhotos.join(',');

            const totalDrops = freshOrder.trip_drop_count || 1;
            const filledDoCount = currentPhotos.filter((url: string, idx: number) => idx % 2 === 0 && Boolean(url && url.trim())).length;
            const completedDrops = countCompletedDrops(updatedPodUrl);

            // Construct notes update (fallback)
            let updatedNotes = freshOrder.notes || '';
            if (extractedDoNumber) {
                const cleanNotes = (freshOrder.notes || '').replace(/\[AI DO:\s*.*?\]/g, '').trim();
                updatedNotes = cleanNotes 
                    ? `${cleanNotes}\n[AI DO: ${extractedDoNumber}]`
                    : `[AI DO: ${extractedDoNumber}]`;
            }

            // Clear or update Hantaran Separa note if all drops/DOs are filled
            if ((completedDrops >= totalDrops || filledDoCount >= totalDrops) && updatedNotes.includes('Hantaran Separa')) {
                updatedNotes += `\n[${timeStr}] ✅ DO tertunggak telah dimuat naik. Semua ${totalDrops} drops lengkap.`;
            }

            const updatePayload: any = { 
                pod_photo_url: updatedPodUrl,
                notes: updatedNotes
            };

            // If order was in Loaded due to incomplete drops/DOs, auto-promote to Delivered once all drops/DOs are completed
            if (freshOrder.status === 'Loaded' && (completedDrops >= totalDrops || filledDoCount >= totalDrops)) {
                updatePayload.status = 'Delivered';
            }

            // Update database
            const { error: updateErr } = await supabase
                .from('sales_orders')
                .update(updatePayload)
                .eq('id', target.orderId);

            if (updateErr) throw updateErr;

            alert("✅ Gambar DO berjaya dimuat naik! / DO Photo successfully uploaded!");
            
            // Refresh tasks
            fetchTasks();
        } catch (err: any) {
            alert("Gagal memproses/memuat naik gambar: " + err.message);
        } finally {
            setLaterUploading(false);
            setLaterUploadTarget(null);
            laterUploadTargetRef.current = null;
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
            hasScannedRef.current = false; // Scan failed, unlock scan so driver can retry
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

        if (detectedMileage !== null && Math.abs(detectedMileage - mileageVal) > 100) {
            const proceed = window.confirm(`⚠️ AMARAN AI! (AI WARNING!)\n\nAI membaca [ ${detectedMileage} km ] dari gambar, tetapi anda menaip [ ${mileageVal} km ].\n\nAdakah anda pasti gambar yang diunggah adalah betul? Jika anda memalsukan rekod, tindakan tatatertib akan diambil.\n(AI read ${detectedMileage} km but you typed ${mileageVal} km. Are you sure?)\n\nTeruskan? / Proceed?`);
            if (!proceed) return;
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

            // Helper to fetch true latest mileage across all drivers
            const getLatestMileage = async (lorryId: string): Promise<{ mileage: number } | null> => {
                try {
                    const res = await fetch(`/api/lorry-latest-mileage?lorry_id=${encodeURIComponent(lorryId)}`);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && typeof json.mileage === 'number') {
                            return { mileage: json.mileage };
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch latest mileage from API, falling back to direct query:", e);
                }

                try {
                    const { data: directLog } = await supabase
                        .from('lorry_mileage_logs')
                        .select('mileage')
                        .eq('lorry_id', lorryId)
                        .lte('created_at', new Date().toISOString())
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (directLog && typeof directLog.mileage === 'number') {
                        return directLog;
                    }
                } catch (e) {
                    console.warn("Direct query failed:", e);
                }
                return null;
            };

            // Handle BIND / START SHIFT
            if (scannedLorryData.mode === 'bind') {
                // Fetch previous mileage log for discrepancy check
                const lastLog = await getLatestMileage(scannedLorryData.id);

                // When starting shift (bind), expected mileage should be the last parked reading.
                // An anomaly occurs if:
                // 1. diff < 0 (odometer rolled back or entered smaller number)
                // 2. diff > 100 (vehicle moved >100 km off-the-record without driver binding)
                if (lastLog) {
                    const diff = mileageVal - lastLog.mileage;
                    const isDiscrepancy = diff < 0 || diff > 100;

                    if (isDiscrepancy) {
                        // If discrepancy is > 2000 km, warn driver with a confirm dialog so legitimate handovers are not permanently blocked
                        if (Math.abs(diff) > 2000) {
                            const proceed = window.confirm(`⚠️ PERBEZAAN PERBATUAN BESAR / LARGE MILEAGE DIFFERENCE\n\nRekod terdahulu / Previous record: ${lastLog.mileage} km\nBacaan semasa / Current reading: ${mileageVal} km\nPerbezaan / Difference: ${diff > 0 ? '+' : ''}${diff} km\n\nAdakah anda pasti bacaan meter ini betul? Rekod amaran akan dihantar kepada Admin.\n(Are you sure this odometer reading is correct? An alert will be recorded for Admin.)\n\nTeruskan? / Proceed?`);
                            if (!proceed) {
                                setSubmittingOdometer(false);
                                return;
                            }
                        }

                        // Create discrepancy alert!
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
                // Fetch previous mileage log for discrepancy check
                const lastLog = await getLatestMileage(scannedLorryData.id);

                // When ending shift (unbind), mileage MUST increase due to normal delivery driving.
                // An anomaly ONLY occurs if:
                // 1. diff < 0 (entered smaller number than shift start, e.g. 2412 instead of 24121)
                // 2. diff > 1200 (unrealistically huge distance for a single shift, e.g. extra digit typed)
                if (lastLog) {
                    const diff = mileageVal - lastLog.mileage;
                    const isDiscrepancy = diff < 0 || diff > 1200;

                    if (isDiscrepancy) {
                        // If discrepancy is > 2000 km, warn driver with a confirm dialog so legitimate handovers are not permanently blocked
                        if (Math.abs(diff) > 2000) {
                            const proceed = window.confirm(`⚠️ PERBEZAAN PERBATUAN BESAR / LARGE MILEAGE DIFFERENCE\n\nRekod terdahulu / Previous record: ${lastLog.mileage} km\nBacaan semasa / Current reading: ${mileageVal} km\nPerbezaan / Difference: ${diff > 0 ? '+' : ''}${diff} km\n\nAdakah anda pasti bacaan meter ini betul? Rekod amaran akan dihantar kepada Admin.\n(Are you sure this odometer reading is correct? An alert will be recorded for Admin.)\n\nTeruskan? / Proceed?`);
                            if (!proceed) {
                                setSubmittingOdometer(false);
                                return;
                            }
                        }

                        // Create discrepancy alert!
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
                }

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

                // 自动完成所有已 Loaded 且上传了足够卸货照片的订单 (严谨校验 multi-drop，防止未送完的订单被误杀)
                const { data: driverLoadedOrders } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, trip_id, trip_drop_count, pod_photo_url, notes')
                    .eq('driver_id', user.uid)
                    .eq('status', 'Loaded');

                let fullyCompletedCount = 0;
                let partialCount = 0;
                let unstartedCount = 0;

                if (driverLoadedOrders && driverLoadedOrders.length > 0) {
                    const fullyDeliveredIds: string[] = [];
                    const partialUpdates: { id: string; notes: string }[] = [];

                    const now = new Date();
                    const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) + ' ' +
                                    now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                    for (const ord of driverLoadedOrders) {
                        const isMultiOrder = driverLoadedOrders.filter(o => o.trip_id && o.trip_id === ord.trip_id).length > 1;
                        const totalDrops = isMultiOrder ? 1 : (ord.trip_drop_count || 1);
                        const completedDrops = countCompletedDrops(ord.pod_photo_url);

                        if (completedDrops >= totalDrops && totalDrops > 0) {
                            fullyDeliveredIds.push(ord.id);
                            fullyCompletedCount++;
                        } else if (completedDrops > 0) {
                            // 部分完成：保留 Loaded 状态，并在 Notes 中记录部分完成时间与已完成 drop 数
                            const partialNote = `[${timeStr}] ⚠️ Hantaran Separa / Partial Delivery (${completedDrops}/${totalDrops} drops completed). Unfinished cargo returned to base.`;
                            const updatedNotes = ord.notes ? `${ord.notes}\n${partialNote}` : partialNote;
                            partialUpdates.push({ id: ord.id, notes: updatedNotes });
                            partialCount++;
                        } else {
                            unstartedCount++;
                        }
                    }

                    if (fullyDeliveredIds.length > 0) {
                        await supabase.from('sales_orders')
                            .update({ status: 'Delivered' })
                            .in('id', fullyDeliveredIds);
                    }

                    for (const pu of partialUpdates) {
                        await supabase.from('sales_orders')
                            .update({ notes: pu.notes })
                            .eq('id', pu.id);
                    }
                }

                if (partialCount > 0 || unstartedCount > 0) {
                    alert(`✅ Syif Selesai & Lori dilepaskan! / Shift completed & Lorry unbound!\n\nRingkasan Pesanan / Orders Summary:\n- Selesai Sepenuhnya (Delivered): ${fullyCompletedCount}\n- Hantaran Separa (Incomplete Drops): ${partialCount}\n- Belum Dihantar (Unstarted): ${unstartedCount}\n\nPesanan yang belum selesai dikekalkan dalam status 'Dalam Proses' untuk tindakan susulan Logistik.`);
                } else {
                    alert("✅ Syif Selesai & Lori dilepaskan! / Shift completed & Lorry unbound!");
                }
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

    // Test & Tutorial Automation Hooks
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__driverDeliveryHooks = {
                scanLorry: (text: string) => handleScanComplete(text),
                setOdometer: (km: string, base64: string) => {
                    setOdometerPhotoBase64(base64);
                    setDetectedMileage(Number(km));
                    setConfirmedMileage(km);
                },
                confirmOdometer: () => handleConfirmOdometer(),
                setUnloadPhotos: (doBase64: string, prodBase64: string, note?: string) => {
                    if (doBase64) setUnloadDoPhotoBase64(doBase64);
                    if (prodBase64) setUnloadProductPhotoBase64(prodBase64);
                    if (note) setDeliveryNote(note);
                },
                confirmUnload: () => handleConfirmUnload(),
                openUnloadModal: (orderId: string) => {
                    const ord = tasks.find(t => t.id === orderId);
                    if (ord) {
                        setSelectedOrder(ord);
                        setIsUnloadModalOpen(true);
                    }
                }
            };
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).__driverDeliveryHooks;
            }
        };
    }, [tasks, currentLorry, scannedLorryData, confirmedMileage, odometerPhotoBase64, unloadProductPhotoBase64, unloadDoPhotoBase64, deliveryNote, selectedOrder]);

    // View Logic
    const todoList = tasks.filter(t => 
        t.status !== 'Cancelled' && 
        !isOrderFullyDelivered(t)
    );
    const doneList = tasks.filter(t => 
        t.status !== 'Cancelled' && 
        isOrderFullyDelivered(t)
    );

    interface DriverTripGroup {
        key: string;
        tripId?: string;
        tripNumber: string;
        tripIndexLabel?: string;
        isAdHoc: boolean;
        orders: SalesOrder[];
        totalDrops: number;
        completedDrops: number;
        totalRolls: number;
        cargoBreakdown: Array<{ name: string; sku?: string; qty: number; warehouse?: string }>;
        zone?: string;
        tripOrigin?: string;
        deliveryDate?: string;
        tripNotes?: string;
        isAllDone: boolean;
        sortSeq?: number;
    }

    const tripGroups = React.useMemo<DriverTripGroup[]>(() => {
        const multiDropMap = new Map<string, DriverTripGroup>();
        const extraJobOrders: SalesOrder[] = [];

        // Helper to compute items breakdown
        const getCargoSummary = (orderList: SalesOrder[]) => {
            const itemMap = new Map<string, { name: string; sku?: string; qty: number; warehouse?: string }>();
            orderList.forEach(order => {
                (order.items || []).forEach((it: any) => {
                    const key = it.product || it.sku || 'Item';
                    const qty = Number(it.quantity) || 0;
                    const wh = it.sourceLocation || ((order as any).trip_origin ? String((order as any).trip_origin) : 'OPM Lama');
                    if (itemMap.has(key)) {
                        itemMap.get(key)!.qty += qty;
                    } else {
                        itemMap.set(key, {
                            name: key,
                            sku: it.sku,
                            qty,
                            warehouse: wh
                        });
                    }
                });
            });
            const cargoBreakdown = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);
            const totalRolls = cargoBreakdown.reduce((sum, i) => sum + i.qty, 0);
            return { cargoBreakdown, totalRolls };
        };

        // Classify and Smart-Group orders into Trips
        tasks.forEach(order => {
            const isExtraJob = (order as any).job_type === 'Extra Job' || (order as any).job_type === 'Pick Up' || order.orderNumber?.startsWith('TRIP-JOB') || order.orderNumber?.startsWith('TRIP-PU');
            const tripId = (order as any).trip_id;

            if (isExtraJob) {
                extraJobOrders.push(order);
            } else {
                let groupKey = '';
                let tripNum = '';
                let tripIndexLabel: string | undefined = undefined;
                let sortSeq = 999;
                const tripOrigin = (order as any).trip_origin;
                const deliveryDate = (order as any).deliveryDate || (order as any).deadline || (order as any).orderDate;

                if (tripId) {
                    groupKey = `trip_${tripId}`;
                    const v2Trip = tripsV2List.find(t => t.id === tripId);
                    tripNum = v2Trip?.trip_number || (order as any).trip_number || (order.orderNumber ? `TRIP-${order.orderNumber}` : `TRIP-${tripId.slice(0, 8)}`);
                    if ((v2Trip as any)?.trip_sequence && Number((v2Trip as any).trip_sequence) !== 999) {
                        sortSeq = Number((v2Trip as any).trip_sequence);
                        tripIndexLabel = `Trip ${sortSeq}`;
                    }
                } else {
                    // Smart grouping for orders without trip_id (matches OrderSummary logic)
                    const dateKey = (deliveryDate || '').slice(0, 10);
                    const extracted = extractTripIdentifier(order.notes);
                    const isExplicitSeq = (order as any).tripSequence && (order as any).tripSequence !== 999 
                        ? (order as any).tripSequence 
                        : ((order as any).trip_sequence && (order as any).trip_sequence !== 999 ? (order as any).trip_sequence : null);
                    const tripTag = extracted.tripTag || (isExplicitSeq ? `Trip ${isExplicitSeq}` : 'Trip 1');
                    const seq = extracted.tripSeq || (isExplicitSeq ? Number(isExplicitSeq) : 1);
                    
                    groupKey = `smart_trip_${dateKey || 'nodate'}_${tripTag.replace(/\s+/g, '_')}`;
                    const driverPrefix = user?.name ? user.name.split(' ')[0].toUpperCase() : 'DRIVER';
                    const dateCode = dateKey ? dateKey.replace(/-/g, '').slice(2) : '';
                    tripNum = `TRIP-${driverPrefix}${dateCode ? `-${dateCode}` : ''}-${tripTag}`;
                    tripIndexLabel = tripTag;
                    sortSeq = seq;
                }

                if (!multiDropMap.has(groupKey)) {
                    multiDropMap.set(groupKey, {
                        key: groupKey,
                        tripId: tripId || undefined,
                        tripNumber: tripNum,
                        tripIndexLabel,
                        isAdHoc: false,
                        orders: [],
                        totalDrops: 0,
                        completedDrops: 0,
                        totalRolls: 0,
                        cargoBreakdown: [],
                        zone: order.zone,
                        tripOrigin,
                        deliveryDate,
                        tripNotes: undefined,
                        isAllDone: false,
                        sortSeq
                    });
                }
                const grp = multiDropMap.get(groupKey)!;
                grp.orders.push(order);
                if (!grp.zone && order.zone) grp.zone = order.zone;
                if (!grp.tripOrigin && tripOrigin) grp.tripOrigin = tripOrigin;
                if (!grp.deliveryDate && deliveryDate) grp.deliveryDate = deliveryDate;
            }
        });

        const result: DriverTripGroup[] = [];

        // 1. Process Trips
        multiDropMap.forEach(grp => {
            grp.orders.sort((a: any, b: any) => {
                const stopA = (a.stop_sequence !== undefined && a.stop_sequence !== null && a.stop_sequence !== 999) ? a.stop_sequence : 999;
                const stopB = (b.stop_sequence !== undefined && b.stop_sequence !== null && b.stop_sequence !== 999) ? b.stop_sequence : 999;
                if (stopA !== stopB) return stopA - stopB;
                return String(a.orderNumber || a.order_number || '').localeCompare(String(b.orderNumber || b.order_number || ''));
            });

            // Calculate true total drops for this trip group:
            // - If single order with multiple drops, total is that order's trip_drop_count
            // - If multiple orders where each order records the batch drop count (e.g. trip_drop_count == orders.length), total is orders.length
            // - Otherwise, max of order count and the maximum recorded drop count
            const maxOrderDrop = Math.max(...grp.orders.map(o => Number((o as any).trip_drop_count) || 1));
            const calculatedTotalDrops = Math.max(grp.orders.length, maxOrderDrop);
            grp.totalDrops = calculatedTotalDrops;

            grp.completedDrops = grp.orders.reduce((sum, o) => {
                const ordDone = countCompletedDrops(o.pod_photo_url);
                const orderDropTarget = Math.max(1, Number((o as any).trip_drop_count) || 1);
                const effectiveDone = o.status === 'Delivered' 
                    ? Math.max(orderDropTarget, ordDone)
                    : ordDone;
                return sum + effectiveDone;
            }, 0);
            grp.completedDrops = Math.min(grp.completedDrops, grp.totalDrops);

            // Trip is only all done if all orders are fully delivered and all drops met
            const isMultiOrder = grp.orders.length > 1;
            const areAllOrdersDelivered = grp.orders.every(o => isOrderFullyDelivered(o, isMultiOrder));
            grp.isAllDone = areAllOrdersDelivered && grp.completedDrops >= grp.totalDrops && grp.totalDrops > 0;

            // Extract Trip Remark or sequence if present
            for (const ord of grp.orders) {
                if (ord.notes && ord.notes.includes('[Trip:')) {
                    const m = ord.notes.match(/\[Trip:\s*([^\]]+)\]/);
                    if (m) {
                        grp.tripNotes = m[1].trim();
                        break;
                    }
                }
            }

            // Check if trip sequence is specified (ignoring 999 unsequenced flag)
            if (grp.tripId) {
                const v2Trip = tripsV2List.find(t => t.id === grp.tripId);
                if ((v2Trip as any)?.trip_sequence && Number((v2Trip as any).trip_sequence) !== 999) {
                    grp.sortSeq = Number((v2Trip as any).trip_sequence);
                    grp.tripIndexLabel = `Trip ${grp.sortSeq}`;
                }
            }

            // Fallback metadata
            if (!grp.zone) grp.zone = grp.orders.find(o => o.zone)?.zone;
            if (!grp.tripOrigin) grp.tripOrigin = grp.orders.find(o => (o as any).trip_origin)?.trip_origin;
            if (!grp.deliveryDate) grp.deliveryDate = grp.orders.find(o => (o as any).deliveryDate)?.deliveryDate || grp.orders.find(o => (o as any).deadline)?.deadline;

            const { cargoBreakdown, totalRolls } = getCargoSummary(grp.orders);
            grp.cargoBreakdown = cargoBreakdown;
            grp.totalRolls = totalRolls;

            result.push(grp);
        });

        // 3. Process Ad-hoc / Extra Jobs
        if (extraJobOrders.length > 0) {
            const { cargoBreakdown, totalRolls } = getCargoSummary(extraJobOrders);
            const extraCompleted = extraJobOrders.filter(o => isOrderFullyDelivered(o)).length;

            result.push({
                key: 'adhoc_extra_jobs',
                tripNumber: 'Tugasan Luar & Pesanan Tambahan / Ad-hoc & Extra Jobs',
                tripIndexLabel: 'Ad-hoc',
                isAdHoc: true,
                orders: extraJobOrders,
                totalDrops: extraJobOrders.length,
                completedDrops: extraCompleted,
                totalRolls,
                cargoBreakdown,
                isAllDone: extraCompleted === extraJobOrders.length && extraJobOrders.length > 0,
                sortSeq: 9999
            });
        }

        // 4. Sort Trips: Delivery Date Ascending -> Regular before AdHoc -> Trip Seq Ascending -> Trip Number
        result.sort((a, b) => {
            const dateA = a.deliveryDate || '9999-99-99';
            const dateB = b.deliveryDate || '9999-99-99';
            if (dateA !== dateB) return dateA.localeCompare(dateB);

            if (a.isAdHoc !== b.isAdHoc) return a.isAdHoc ? 1 : -1;

            const seqA = a.sortSeq !== undefined ? a.sortSeq : 999;
            const seqB = b.sortSeq !== undefined ? b.sortSeq : 999;
            if (seqA !== seqB) return seqA - seqB;

            return String(a.tripNumber || '').localeCompare(String(b.tripNumber || ''));
        });

        // 5. Assign fallback Trip Index Label for trips sharing a date without explicit trip note
        const dateMap = new Map<string, DriverTripGroup[]>();
        result.forEach(grp => {
            if (grp.isAdHoc) return;
            const d = grp.deliveryDate || 'nodate';
            if (!dateMap.has(d)) dateMap.set(d, []);
            dateMap.get(d)!.push(grp);
        });

        dateMap.forEach(groupList => {
            if (groupList.length > 1) {
                groupList.forEach((grp, idx) => {
                    if (!grp.tripIndexLabel) {
                        const num = idx + 1;
                        const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
                        grp.tripIndexLabel = `${num}${suffix} Trip`;
                    }
                });
            } else if (groupList.length === 1 && !groupList[0].tripIndexLabel) {
                groupList[0].tripIndexLabel = groupList[0].totalDrops > 1 ? `${groupList[0].totalDrops} Drops` : '1 Drop';
            }
        });

        return result;
    }, [tasks, tripsV2List, currentLorry]);

    const pendingTrips = React.useMemo(() => tripGroups.filter(t => !t.isAllDone), [tripGroups]);
    const doneTrips = React.useMemo(() => tripGroups.filter(t => t.isAllDone), [tripGroups]);
    const currentTripList = activeTab === 'todo' ? pendingTrips : doneTrips;

    const pendingDropsCount = React.useMemo(() => pendingTrips.reduce((acc, t) => acc + (t.totalDrops - t.completedDrops), 0), [pendingTrips]);
    const doneDropsCount = React.useMemo(() => doneTrips.reduce((acc, t) => acc + t.completedDrops, 0), [doneTrips]);

    const toggleTripExpand = (tripKey: string, defaultExpanded: boolean) => {
        setExpandedTripKeys(prev => {
            const isCurrentExpanded = prev[tripKey] !== undefined ? prev[tripKey] : defaultExpanded;
            return {
                ...prev,
                [tripKey]: !isCurrentExpanded
            };
        });
    };

    const renderOrderCard = (order: SalesOrder, isMultiOrderTrip: boolean = false) => {
        const isExtraJob = (order as any).job_type === 'Extra Job' || (order as any).job_type === 'Pick Up' || order.orderNumber?.startsWith('TRIP-JOB') || order.orderNumber?.startsWith('TRIP-PU') || (order.notes && order.notes.startsWith('[') && (!order.items || order.items.length === 0));

        if (isExtraJob) {
            const extraJobPhoto = (order as any).proof_of_load_url || (order as any).proofOfLoadUrl;
            const categoryIconMap: Record<string, string> = {
                'SHOPEE': '🛍️',
                'AMBIK PALLET': '🪵',
                'LORRY SERVICE': '🔧',
                'RETURN': '↩️',
                'OTHER': '🛠️'
            };
            const categoryIcon = categoryIconMap[order.zone?.toUpperCase() || ''] || '📸';

            return (
                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative">
                    {/* Status Strip */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        order.status === 'Delivered' ? 'bg-emerald-500' :
                        order.status === 'Pending Approval' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />

                    <div className="p-4 sm:p-5 pl-6 sm:pl-7">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                    <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                        <span>{categoryIcon}</span>
                                        <span>{order.zone || 'Extra Job'}</span>
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                        {order.orderNumber}
                                    </span>
                                </div>
                                <h2 className="text-base font-black text-white leading-tight">
                                    {order.deliveryAddress || 'Tugasan Luar / Ad-hoc Task'}
                                </h2>
                                {order.deliveryDate && (() => {
                                    const d = new Date(order.deliveryDate);
                                    const isValid = !isNaN(d.getTime());
                                    const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
                                    return (
                                        <div className="flex items-center gap-2 mt-1 text-xs font-bold uppercase tracking-wider">
                                            {isValid && <span className="text-orange-400">{days[d.getDay()]}</span>}
                                            <span className="text-slate-400">
                                                {isValid ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : order.deliveryDate}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Driver Photo Proof */}
                        {extraJobPhoto && (
                            <div className="mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <p className="text-[10px] text-emerald-400 uppercase font-black mb-2 flex items-center gap-1">
                                    📸 Bukti Gambar Tugasan / Task Photo Proof
                                </p>
                                <div className="w-full h-44 rounded-lg overflow-hidden border border-slate-700 bg-black relative group">
                                    <img
                                        src={extraJobPhoto}
                                        alt="Proof"
                                        className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform"
                                        onClick={() => setPreviewImageUrl(extraJobPhoto)}
                                    />
                                    <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] text-emerald-300 font-bold">
                                        Ketik untuk besarkan gambar
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {order.notes && (
                            <div className="mb-4 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
                                <p className="text-[10px] text-slate-500 uppercase font-black mb-1">Catatan / Notes</p>
                                <p className="text-slate-300 italic whitespace-pre-line">{order.notes}</p>
                            </div>
                        )}

                        {/* Status Bar */}
                        <div className={`p-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 ${
                            order.status === 'Pending Approval'
                                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                : order.status === 'Delivered'
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                                : 'bg-red-500/15 border border-red-500/30 text-red-300'
                        }`}>
                            {order.status === 'Pending Approval' ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                                    <span>🟡 Sedang Menunggu Kelulusan Admin / Pending Approval</span>
                                </>
                            ) : order.status === 'Delivered' ? (
                                <>
                                    <CheckCircle size={15} />
                                    <span>✅ Diluluskan & Gaji Dikreditkan / Approved</span>
                                </>
                            ) : (
                                <>
                                    <X size={15} />
                                    <span>❌ Ditolak / Rejected</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        const isDeliveredOrDone = isOrderFullyDelivered(order, isMultiOrderTrip);

        return (
            <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative">
                {/* Status Strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isDeliveredOrDone ? 'bg-emerald-500' :
                    order.status === 'Pending Approval' ? 'bg-yellow-500' :
                    order.status === 'Loaded' ? 'bg-blue-500' :
                    'bg-slate-600'
                }`} />

                {/* Card Body */}
                <div className="p-4 sm:p-5 pl-6 sm:pl-7">
                    <div className="mb-4">
                        {/* Badges bar */}
                        <div className="flex items-center flex-wrap gap-1.5 mb-2">
                            {(order as any).stop_sequence !== undefined && (order as any).stop_sequence !== null && (
                                <span className="text-[11px] font-black uppercase bg-purple-600/30 text-purple-300 px-2.5 py-0.5 rounded-md border border-purple-500/40 flex items-center gap-1">
                                    🎯 Hentian / Drop #{(order as any).stop_sequence}
                                </span>
                            )}
                            {order.orderNumber && (
                                <span className="text-[11px] font-mono font-black uppercase bg-blue-600/20 text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-500/30">
                                    DO: {order.orderNumber}
                                </span>
                            )}
                            {(order as any).terms && (
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                    String((order as any).terms || '').toUpperCase().includes('C.O.D') 
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                                        : 'bg-slate-700/50 text-slate-300 border-slate-600'
                                }`}>
                                    {(order as any).terms}
                                </span>
                            )}
                            {(order as any).do_total && (
                                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                                    {(order as any).do_total} Rolls
                                </span>
                            )}
                            {(order as any).trip_origin && <span className="text-[10px] font-black uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">{(order as any).trip_origin}</span>}
                            {order.zone && <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">{order.zone}</span>}
                            {!(order as any).stop_sequence && (order as any).trip_drop_count > 1 && (
                                <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                    {(order as any).trip_drop_count} Hentian / Drops
                                </span>
                            )}
                        </div>

                        {/* Customer Name */}
                        {order.customer && (
                            <h2 className="text-lg font-black text-white leading-tight tracking-tight flex items-baseline gap-1.5 mb-1.5">
                                <span>🏢</span>
                                <span>{order.customer}</span>
                            </h2>
                        )}

                        {/* Address & Navigation */}
                        {order.deliveryAddress && (
                            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-start justify-between gap-2.5 mt-2">
                                <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed flex items-start gap-1.5">
                                    <MapPin size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                    <span>{order.deliveryAddress}</span>
                                </div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="shrink-0 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[11px] font-black flex items-center gap-1 shadow transition-all"
                                >
                                    <span>Peta</span>
                                    <ExternalLink size={10} />
                                </a>
                            </div>
                        )}

                        {/* Phone / WhatsApp Action Bar */}
                        {(order as any).customer_phone && (
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                <a
                                    href={`tel:${(order as any).customer_phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-black shadow-md shadow-emerald-950/30 transition-all"
                                >
                                    <Phone size={12} />
                                    <span>Hubungi / Call: {(order as any).customer_phone}</span>
                                </a>
                                <a
                                    href={`https://wa.me/${String((order as any).customer_phone).replace(/[^0-9]/g, '').replace(/^0/, '60')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 active:scale-95 text-white rounded-lg text-xs font-black shadow transition-all"
                                >
                                    <MessageCircle size={12} />
                                    <span>WhatsApp</span>
                                </a>
                            </div>
                        )}

                        {/* Delivery Date */}
                        {(order as any).deliveryDate && (() => {
                            const d = new Date((order as any).deliveryDate);
                            const isValid = !isNaN(d.getTime());
                            const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
                            return (
                                <div className="flex items-center gap-2 mt-2 text-xs font-bold uppercase tracking-wider">
                                    {isValid && <span className="text-orange-400">{days[d.getDay()]}</span>}
                                    <span className="text-slate-400">
                                        {isValid ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : String((order as any).deliveryDate)}
                                    </span>
                                </div>
                            );
                        })()}
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

                    {/* Order Items */}
                    <div className="space-y-3 mb-6">
                        {(() => {
                            const grouped = (order.items || []).reduce((acc: any, item: any) => {
                                let loc = item.sourceLocation || 'Other Items';

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

                    {/* POD Photos and Notes (1 DO = 1 Drop Point) */}
                    {(() => {
                        const rawPodStr = order.pod_photo_url ? order.pod_photo_url.trim() : '';
                        const rawPhotosList = rawPodStr ? rawPodStr.split(',') : [];
                        const completedDropsCount = countCompletedDrops(order.pod_photo_url);

                        return (
                            <>
                                {order.pod_photo_url && (
                                    <div className="mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="text-[10px] text-emerald-400 uppercase font-black flex items-center gap-1">
                                                📸 Bukti Penghantaran / Proof of Delivery (POD)
                                            </p>
                                            {(() => {
                                                const totalDrops = Math.max(1, Number((order as any).trip_drop_count) || 1);
                                                if (completedDropsCount >= totalDrops && totalDrops > 0) {
                                                    return (
                                                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                                                            ✅ Selesai / Completed ({completedDropsCount}/{totalDrops})
                                                        </span>
                                                    );
                                                }
                                                if (completedDropsCount > 0) {
                                                    return (
                                                        <span className="text-[10px] font-mono font-bold text-blue-400">
                                                            🚚 Dalam Perjalanan ({completedDropsCount}/{totalDrops} Drops)
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                                        Menunggu / Pending
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {rawPhotosList.map((url, idx) => {
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
                            </>
                        );
                    })()}

                    {/* ACTION BUTTONS */}
                    {isDeliveredOrDone ? (
                        <div className="space-y-2">
                            <div className={`text-center py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 ${
                                order.status === 'Pending Approval'
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
                            <button
                                onClick={() => handleOpenUnloadModal(order)}
                                data-action="OPEN_APPEND_DROP_MODAL"
                                data-action-name="补充添加送货点与照片"
                                data-target={`工单 #${order.orderNumber || order.id}`}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
                            >
                                <Camera size={14} className="text-emerald-400" />
                                <span>+ Kemaskini Foto POD / Update POD</span>
                            </button>
                        </div>
                    ) : (
                        (order.status === 'Loaded' || order.status === 'Pending Approval' || !isDeliveredOrDone) ? (() => {
                            const btnTotalDrops = isMultiOrderTrip ? 1 : Math.max(1, Number((order as any).trip_drop_count) || 1);
                            const btnDoneDrops = countCompletedDrops(order.pod_photo_url);
                            return (
                                <button
                                    onClick={() => handleOpenUnloadModal(order)}
                                    data-action="OPEN_UNLOAD_MODAL"
                                    data-action-name="打开送货签收窗口"
                                    data-target={`工单 #${order.orderNumber || order.id}`}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-sm tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-950/30 active:scale-95 transition-all"
                                >
                                    <CheckCircle size={18} />
                                    <span>
                                        Sahkan Hantaran / Confirm Delivery
                                        {btnTotalDrops > 1 && ` (Drop ${Math.min(btnDoneDrops + 1, btnTotalDrops)}/${btnTotalDrops})`}
                                    </span>
                                    <ChevronRight size={16} className="opacity-50" />
                                </button>
                            );
                        })() : (
                            <div className="w-full py-3.5 px-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span className="text-amber-300 font-bold">Menunggu Muatan Trip / Awaiting Trip Load</span>
                                </div>
                                <button
                                    onClick={() => {
                                        const parentTrip = tripGroups.find(t => t.orders.some(o => o.id === order.id));
                                        if (parentTrip) {
                                            handleOpenTripLoadModal(parentTrip);
                                        } else {
                                            handleOpenLoadModal(order);
                                        }
                                    }}
                                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Muat Trip ↑</span>
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        );
    };

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
                        onClick={() => {
                            setIsPickUpModalOpen(true);
                            if (navigator.geolocation) {
                                setPickupLocation('Searching GPS...');
                                navigator.geolocation.getCurrentPosition(
                                    async (pos) => {
                                        const addr = await fetchAddressFromCoords(pos.coords.latitude, pos.coords.longitude);
                                        setPickupLocation(addr);
                                    },
                                    () => setPickupLocation('GPS Unavailable'),
                                    { enableHighAccuracy: true, timeout: 5000 }
                                );
                            }
                        }}
                        disabled={uploadingPhoto}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        <span>📸</span>
                        <span className="hidden sm:inline"> TUGASAN TAMBAHAN / EXTRA JOB</span>
                        <span className="inline sm:hidden"> EXTRA JOB</span>
                    </button>

                    <button
                        onClick={() => setIsTutorialModalOpen(true)}
                        className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Video Tutorial / 教学视频"
                    >
                        <span>🎥</span>
                        <span className="hidden sm:inline">TUTORIAL</span>
                        <span className="inline sm:hidden">VIDEO</span>
                    </button>

                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('delivery-history')}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            title="Sejarah Penghantaran / Delivery History"
                        >
                            <span>📜</span>
                            <span className="hidden sm:inline">SEJARAH</span>
                        </button>
                    )}

                    <button
                        onClick={() => fetchTasks()}
                        disabled={loading}
                        className="p-1.5 bg-slate-800 rounded-lg text-blue-400 border border-slate-700 active:scale-95 transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 📡 网页端实时 GPS 上报状态条 */}
            <div className="px-4 pt-3">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${webGpsActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="font-medium text-slate-300">{webGpsStatus}</span>
                    </div>
                    <button
                        onClick={() => setWebGpsActive(!webGpsActive)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[11px] font-bold"
                    >
                        {webGpsActive ? '关闭网页 GPS' : '开启网页 GPS'}
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
                            onClick={() => { setScannerMode('unbind'); hasScannedRef.current = false; setIsScannerOpen(true); }}
                            disabled={submitting}
                            className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-300 tracking-wider transition-all disabled:opacity-50"
                        >
                            TAMAT SYIF / END SHIFT
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => { setScannerMode('bind'); hasScannedRef.current = false; setIsScannerOpen(true); }}
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
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm tracking-wider transition-all ${
                        activeTab === 'todo' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 text-slate-500'
                    }`}
                >
                    Dalam Proses / Pending ({pendingTrips.length} {pendingTrips.length === 1 ? 'Trip' : 'Trips'})
                </button>
                <button
                    onClick={() => setActiveTab('done')}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm tracking-wider transition-all ${
                        activeTab === 'done' ? 'bg-green-600/20 text-green-500 border border-green-500/30' : 'bg-slate-900 text-slate-500'
                    }`}
                >
                    Selesai / Done ({doneTrips.length} {doneTrips.length === 1 ? 'Trip' : 'Trips'})
                </button>
            </div>

            {/* LIST (TRIP ACCORDION) */}
            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-500 animate-pulse">Memuatkan... / Loading...</div>
                ) : currentTripList.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800">
                        <Package size={40} className="mx-auto mb-3 text-slate-700" />
                        <h3 className="font-bold text-slate-500">Tiada pesanan ditemui. / No orders found.</h3>
                    </div>
                ) : (
                    currentTripList.map((trip, tripIndex) => {
                        const defaultOpen = activeTab === 'todo' && (tripIndex === 0 || currentTripList.length <= 2);
                        const isExpanded = expandedTripKeys[trip.key] !== undefined ? expandedTripKeys[trip.key] : defaultOpen;

                        return (
                            <div
                                key={trip.key}
                                className={`border rounded-2xl overflow-hidden shadow-xl transition-all ${
                                    trip.isAllDone 
                                        ? 'bg-slate-900/90 border-emerald-500/40' 
                                        : 'bg-slate-900 border-blue-500/40'
                                }`}
                            >
                                {/* Header (Click to toggle expand/collapse) */}
                                <div
                                    onClick={() => toggleTripExpand(trip.key, defaultOpen)}
                                    className="p-4 cursor-pointer select-none hover:bg-slate-800/40 active:bg-slate-800/60 transition-colors flex items-center justify-between gap-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                                            <span className={`text-xs font-mono font-black uppercase px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${
                                                trip.isAdHoc 
                                                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                                                    : 'bg-blue-600/25 text-blue-300 border-blue-500/40'
                                            }`}>
                                                <Truck size={13} />
                                                <span>{trip.tripNumber}</span>
                                            </span>

                                            {trip.tripIndexLabel && (
                                                <span className="text-[10px] font-black uppercase bg-purple-600/25 text-purple-300 px-2 py-0.5 rounded border border-purple-500/40">
                                                    {trip.tripIndexLabel}
                                                </span>
                                            )}

                                            {trip.tripOrigin && (
                                                <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                    🏭 {trip.tripOrigin}
                                                </span>
                                            )}

                                            {trip.zone && (
                                                <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                                                    📍 {trip.zone}
                                                </span>
                                            )}

                                            {(() => {
                                                const isTripFullyLoaded = trip.orders.every(o => o.status === 'Loaded' || o.status === 'Delivered' || o.status === 'Pending Approval');
                                                if (trip.isAllDone) {
                                                    return (
                                                        <span className="text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                                                            ✅ Selesai / Done
                                                        </span>
                                                    );
                                                }
                                                if (isTripFullyLoaded) {
                                                    return (
                                                        <span className="text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                                                            🚚 Dimuat / Loaded
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Belum Muat
                                                    </span>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-bold">
                                            <span className="text-slate-400">
                                                {trip.deliveryDate ? new Date(trip.deliveryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Hari Ini'}
                                            </span>
                                            <span className="text-slate-600">•</span>
                                            <span className={trip.completedDrops === trip.totalDrops ? 'text-emerald-400 font-black' : 'text-blue-400'}>
                                                {trip.completedDrops}/{trip.totalDrops} Hentian Selesai ({trip.totalDrops} Drops)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Rolls badge & Toggle arrow */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {trip.totalRolls > 0 && (
                                            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-black">
                                                {trip.totalRolls} Rolls
                                            </span>
                                        )}
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Body */}
                                {isExpanded && (
                                    <div className="border-t border-slate-800/80 bg-black/40 p-3 sm:p-4 space-y-4">
                                        {/* Trip Remark Banner */}
                                        {trip.tripNotes && (
                                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                                                <span className="text-amber-400 text-base mt-0.5">📢</span>
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                                                        Nota Trip / Trip Remark
                                                    </span>
                                                    <p className="text-xs text-amber-200 font-medium whitespace-pre-line leading-relaxed">
                                                        {trip.tripNotes}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Per-Trip Cargo Summary */}
                                        {trip.cargoBreakdown.length > 0 && (
                                            <div className="bg-gradient-to-br from-slate-900 via-[#131722] to-slate-950 border border-blue-500/30 rounded-xl p-3.5 shadow-inner">
                                                <div className="flex items-center justify-between mb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">📦</span>
                                                        <div>
                                                            <h4 className="text-xs font-black text-white uppercase tracking-wider">
                                                                Muatan Khas Trip Ini / This Trip's Cargo
                                                            </h4>
                                                            <p className="text-[10px] text-slate-400 font-bold">
                                                                Semak kuantiti sebelum muat / Check items before departure
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-black">
                                                        Jumlah: {trip.totalRolls} Rolls
                                                    </span>
                                                </div>

                                                {/* Grid */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {trip.cargoBreakdown.map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="bg-black/60 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-sm"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-black text-slate-100 truncate" title={item.name}>
                                                                    {item.name}
                                                                </p>
                                                                {item.warehouse && (
                                                                    <span className="text-[9px] font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/60 inline-block mt-0.5">
                                                                        📍 {item.warehouse}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="text-base font-mono font-black text-amber-400">
                                                                    {item.qty}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Trip-Level Naik Barang Button */}
                                        {(() => {
                                            const isTripFullyLoaded = trip.orders.every(o => o.status === 'Loaded' || o.status === 'Delivered' || o.status === 'Pending Approval');
                                            if (isTripFullyLoaded) return null;
                                            return (
                                                <button
                                                    onClick={() => handleOpenTripLoadModal(trip)}
                                                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-blue-950/50 active:scale-98 transition-all cursor-pointer"
                                                >
                                                    <Truck size={18} />
                                                    <span>
                                                        {trip.orders.length === 1 
                                                            ? '🚚 NAIK BARANG TRIP INI / LOAD THIS TRIP' 
                                                            : `🚚 NAIK BARANG TRIP INI / LOAD THIS TRIP (${trip.orders.length} DOs)`}
                                                    </span>
                                                </button>
                                            );
                                        })()}

                                        {/* Drops List */}
                                        <div className="space-y-3">
                                            {trip.orders.map((order) => renderOrderCard(order, trip.orders.length > 1))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* LOADING MODAL */}
            {
                isLoadModalOpen && selectedOrder && (
                    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                            <div>
                                <h2 className="font-black text-white text-lg">
                                    {selectedTripForLoad ? 'SAHKAN MUATAN TRIP / VERIFY TRIP' : 'SAHKAN STOK / VERIFY STOCK'}
                                </h2>
                                <p className="text-[11px] text-blue-400 font-mono font-bold">
                                    {selectedTripForLoad 
                                        ? `${selectedTripForLoad.tripNumber} • ${selectedTripForLoad.orders.length} DOs` 
                                        : selectedOrder?.orderNumber}
                                </p>
                            </div>
                            <button onClick={() => { setIsLoadModalOpen(false); setSelectedTripForLoad(null); }} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                        </div>

                        {/* ITEMS LIST (GROUPED BY LOCATION) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-black">
                            {/* Cargo Preparation Photo */}
                            {(() => {
                                const allPrepPhotos = selectedTripForLoad 
                                    ? selectedTripForLoad.orders.flatMap((o: any) => parsePrepPhotos(o.preparation_photo_url))
                                    : parsePrepPhotos((selectedOrder as any)?.preparation_photo_url);
                                const photos = Array.from(new Map(allPrepPhotos.map((p: any) => [p.url, p])).values());
                                if (photos.length === 0) return null;
                                return (
                                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 mb-4">
                                        <p className="text-[10px] text-amber-500 uppercase font-black flex items-center gap-1">
                                            📦 Rujukan Gambar Bersedia / Cargo Prep Photo ({photos.length})
                                        </p>
                                        <div className={`grid gap-2 max-w-sm w-full mx-auto ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {photos.map((p: any, idx: number) => (
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
                                                            <div className="text-[10px] text-slate-500 font-mono">
                                                                Kuantiti / Qty: {item.quantity} {(item as any).packaging || (item as any).uom || ''}
                                                                {item.orderNumber && (
                                                                    <span className="ml-2 text-blue-400 font-semibold">• DO: {item.orderNumber}</span>
                                                                )}
                                                            </div>
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
                            <h2 className="font-black text-white text-lg flex items-center gap-2">
                                <span>SAHKAN HANTARAN / CONFIRM DELIVERY</span>
                                {(() => {
                                    const modalTotal = Math.max(1, Number((selectedOrder as any).trip_drop_count) || 1);
                                    const modalDone = countCompletedDrops(selectedOrder.pod_photo_url);
                                    if (modalTotal > 1) {
                                        return (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded border font-mono bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                Drop #{Math.min(modalDone + 1, modalTotal)} / {modalTotal}
                                            </span>
                                        );
                                    }
                                    if ((selectedOrder as any).stop_sequence) {
                                        return (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded border font-mono bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                Hentian #{(selectedOrder as any).stop_sequence}
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </h2>
                            <p className="text-[11px] text-slate-400 uppercase font-mono font-bold">
                                DO: {selectedOrder.orderNumber} • {selectedOrder.customer}
                            </p>
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
                                    {selectedOrder.pod_photo_url.split(',').filter(Boolean).map((url, idx) => (
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

                        {/* Final Drop Toggle Checkbox for Multi-Drop Orders */}
                        {(selectedOrder as any).trip_drop_count > 1 && (() => {
                            const curDone = countCompletedDrops(selectedOrder.pod_photo_url);
                            const totalTarget = Math.max(1, Number((selectedOrder as any).trip_drop_count) || 1);
                            const isAtFinalStep = curDone + 1 >= totalTarget;

                            return (
                                <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                                    isFinalDrop 
                                        ? 'bg-amber-950/30 border-amber-500/50' 
                                        : 'bg-slate-900 border-slate-800'
                                }`}>
                                    <div className="pr-2">
                                        <p className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                                            {isAtFinalStep ? '🏁 HANTARAN TERAKHIR (TAMAT TRIP)?' : '⚠️ TAMAT TRIP LEBIH AWAL?'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                            {isAtFinalStep 
                                                ? `Hentian ${curDone + 1} daripada ${totalTarget}. Tandakan jika ini hentian terakhir.`
                                                : `Hentian ${curDone + 1} drpd ${totalTarget}. Hanya tanda jika baki ${totalTarget - curDone - 1} hentian dibatalkan.`}
                                        </p>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={isFinalDrop}
                                        onChange={(e) => setIsFinalDrop(e.target.checked)}
                                        className="w-6 h-6 rounded-lg bg-black border border-slate-700 accent-amber-500 outline-none cursor-pointer shrink-0"
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-3 safe-bottom-padding">
                        <button
                            onClick={handleConfirmUnload}
                            disabled={submitting || uploadingTarget !== null || !unloadProductPhotoBase64}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg shadow-emerald-950/40 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    <span>PENGHANTARAN SEDANG DISAHKAN... / CONFIRMING...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} />
                                    <span>SAHKAN HANTARAN / CONFIRM DELIVERY</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* PICK UP / EXTRA JOB MODAL */}
            {isPickUpModalOpen && (() => {
                const driverOrigin = (currentLorry?.factory_id || user?.base_location || 'TAIPING').toUpperCase();
                const matchedRate = deliveryRates.find(r => 
                    r.origin?.toUpperCase() === driverOrigin && 
                    r.location_name?.toUpperCase() === pickUpCategory
                );
                const currentRateAmount = matchedRate ? Number(matchedRate.base_rate) || 0 : 0;

                const EXTRA_JOB_CATEGORIES = [
                    { id: 'SHOPEE', label: 'Shopee', desc: 'Shopee / Parcel', icon: '🛍️' },
                    { id: 'AMBIK PALLET', label: 'Angkat Pallet', desc: 'Pallet Handling', icon: '🪵' },
                    { id: 'LORRY SERVICE', label: 'Lorry Service', desc: 'Servis / Puspakom', icon: '🔧' },
                    { id: 'RETURN', label: 'Return', desc: 'Barang Pulang / Returns', icon: '↩️' },
                    { id: 'OTHER', label: 'Other', desc: 'Lain-lain / Admin Tentukan', icon: '🛠️' },
                ];

                return (
                    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in slide-in-from-bottom-10">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 safe-top-padding">
                            <div>
                                <h2 className="font-black text-emerald-400 text-lg flex items-center gap-2">
                                    📸 TUGASAN TAMBAHAN / EXTRA JOB
                                </h2>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Pilih Kategori Tugasan & Ambil Gambar Bukti</p>
                            </div>
                            <button onClick={() => { setIsPickUpModalOpen(false); setLoadPhotoBase64(null); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white cursor-pointer"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-black">
                            {/* 1. CATEGORY SELECTION */}
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 block flex items-center gap-1.5">
                                    <span>1. PILIH KATEGORI TUGASAN / SELECT CATEGORY</span>
                                    <span className="text-red-400">*</span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {EXTRA_JOB_CATEGORIES.map(cat => {
                                        const isSelected = pickUpCategory === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setPickUpCategory(cat.id)}
                                                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                                                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xl">{cat.icon}</span>
                                                    {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black leading-tight text-white">{cat.label}</p>
                                                    <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{cat.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. SALARY BADGE (SYSTEM PRESET, LOCKED) */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                                        💰 Kadar Gaji Sistem / System Salary Rate
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        Asal / Origin: <strong className="text-slate-300 font-mono">{driverOrigin}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {pickUpCategory === 'OTHER' ? (
                                        <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-300 font-bold text-xs">
                                            Admin / Manager Tentukan Gaji
                                        </div>
                                    ) : (
                                        <div className="bg-emerald-500/15 border border-emerald-500/30 px-4 py-1.5 rounded-xl text-emerald-400 font-mono font-black text-lg">
                                            RM {currentRateAmount.toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic -mt-2">
                                🔒 Kadar gaji telah ditetapkan oleh sistem (tidak boleh diubah oleh pemandu) & akan disahkan oleh Admin/Manager.
                            </p>

                            {/* 3. PHOTO MANDATORY */}
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1.5">
                                    <span>2. BUKTI GAMBAR / PHOTO PROOF</span>
                                    <span className="text-red-400">* Wajib</span>
                                </label>
                                {!loadPhotoBase64 ? (
                                    <button
                                        type="button"
                                        onClick={() => pickUpFileInputRef.current?.click()}
                                        className="w-full py-10 rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 flex flex-col items-center gap-3 transition-all cursor-pointer"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <Camera size={26} />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-black text-emerald-400 block uppercase tracking-wider">
                                                {uploadingPhoto ? 'SEDANG DIPROSES / PROCESSING...' : 'AMBIL GAMBAR BUKTI KERJA / TAKE PHOTO PROOF'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 mt-1 block font-medium">
                                                Ketik untuk buka kamera & ambil gambar tugasan
                                            </span>
                                        </div>
                                    </button>
                                ) : (
                                    <div className="w-full relative rounded-xl overflow-hidden border border-slate-700 bg-black">
                                        <img 
                                            src={`data:image/jpeg;base64,${loadPhotoBase64}`} 
                                            alt="Extra Job Proof" 
                                            className="w-full h-52 object-cover cursor-zoom-in" 
                                            onClick={() => setPreviewImageUrl(`data:image/jpeg;base64,${loadPhotoBase64}`)}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setLoadPhotoBase64(null)}
                                            className="absolute top-3 right-3 p-2 bg-red-500/90 hover:bg-red-600 rounded-full text-white shadow-lg cursor-pointer transition-transform active:scale-90"
                                            title="Ambil gambar semula"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 text-[10px] text-emerald-300 font-bold flex items-center gap-1.5">
                                            <CheckCircle size={12} /> Gambar Berjaya Dimuat Naik
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. NOTE & LOCATION */}
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">3. CATATAN / REMARKS (PILIHAN / OPTIONAL)</label>
                                <textarea
                                    value={pickUpNote}
                                    onChange={e => setPickUpNote(e.target.value)}
                                    placeholder="Contoh: Angkat 20 biji pallet di kilang Skudai / Servis lori di bengkel ABC..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-600 focus:border-emerald-500 outline-none resize-none h-24 text-sm"
                                />
                                {pickupLocation && (
                                    <p className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-1">
                                        📍 Lokasi: {pickupLocation}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-900 safe-bottom-padding">
                            <button
                                type="button"
                                onClick={handleConfirmPickUp}
                                disabled={submitting || !loadPhotoBase64}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-base uppercase tracking-widest shadow-lg shadow-emerald-950/40 disabled:opacity-40 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {submitting ? 'SEDANG DIPROSES / PROCESSING...' : 'HANTAR UNTUK KELULUSAN ADMIN / SUBMIT FOR APPROVAL'}
                            </button>
                        </div>
                    </div>
                );
            })()}

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
                        <button onClick={() => { hasScannedRef.current = true; setTimeout(() => setIsScannerOpen(false), 100); }} className="p-2 bg-slate-800 rounded-full text-white"><X size={20} /></button>
                    </div>
                    
                    <div className="flex-1 bg-black flex flex-col items-center justify-center p-8">
                        <div key={isScannerOpen ? 'scanner-active' : 'scanner-inactive'} className="w-full max-w-sm aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-4 border-slate-800 relative shadow-2xl">
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
                               key="driver-lorry-scanner"
                               onScan={(detectedCodes) => {
                                   if (hasScannedRef.current) return;
                                   if (detectedCodes && detectedCodes.length > 0) {
                                       hasScannedRef.current = true;
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

                        {/* Demo / Manual Bind Shortcut for recording & testing */}
                        <button
                            type="button"
                            onClick={() => {
                                const payload = scannerMode === 'bind'
                                    ? JSON.stringify({ type: 'LorryBind', lorryId: '23572333-dba1-421a-b6fd-83d937cfe954', plate: 'APD 9821' })
                                    : JSON.stringify({ type: 'LorryBind', lorryId: currentLorry?.id || '23572333-dba1-421a-b6fd-83d937cfe954', plate: currentLorry?.plate_number || 'APD 9821' });
                                handleScanComplete(payload);
                            }}
                            className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-400 text-xs font-black rounded-2xl flex items-center gap-2 cursor-pointer shadow-lg transition-all"
                        >
                            <Truck size={14} />
                            <span>⚡ {scannerMode === 'bind' ? 'Pilih Lori Ujian (APD 9821)' : 'Sahkan Pulang Lori (APD 9821)'}</span>
                        </button>
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

            {/* Video Tutorial Modal */}
            <DriverTutorialModal
                isOpen={isTutorialModalOpen}
                onClose={() => setIsTutorialModalOpen(false)}
                initialTab="delivery"
            />

        </div >
    );
};

export default DriverDelivery;
