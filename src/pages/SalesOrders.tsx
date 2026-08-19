import React, { useState, useEffect } from 'react';
import { Search, Plus, Calendar, Trash2, Edit3, Truck, Package, Sparkles, X, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getV2Items } from '../services/apiV2';
import { V2Item } from '../types/v2';
import { determineState, findBestFactory } from '../utils/logistics';
import { useTranslation } from "react-i18next";

const SalesOrders: React.FC = () => {
    const { t } = useTranslation();
    // Orders Data State
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [v2Items, setV2Items] = useState<V2Item[]>([]);
    const [skuMappings, setSkuMappings] = useState<any[]>([]);
    const [sysCustomers, setSysCustomers] = useState<any[]>([]);
    const [stockMap, setStockMap] = useState<Record<string, Record<string, number>>>({});
    const [deliveryRates, setDeliveryRates] = useState<any[]>([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 50;

    // Search and Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [locationFilter, setLocationFilter] = useState('All');
    const [dateRange, setDateRange] = useState<'30days' | 'today' | 'all'>('30days');

    // WhatsApp AI Import Console Toggle
    const [showAIConsole, setShowAIConsole] = useState(false);
    const [whatsappText, setWhatsappText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedOrdersReview, setParsedOrdersReview] = useState<any[]>([]);
    const [showReviewModal, setShowReviewModal] = useState(false);

    // Manual Creation Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any | null>(null);

    // Manual Form Fields
    const [orderCustomer, setOrderCustomer] = useState('');
    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [orderDeadline, setOrderDeadline] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New item inputs in manual form
    const [selectedItemSku, setSelectedItemSku] = useState('');
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [newItemQty, setNewItemQty] = useState<number>(0);
    const [newItemRemark, setNewItemRemark] = useState('');

    useEffect(() => {
        setCurrentPage(1);
    }, [dateRange, searchTerm, statusFilter, locationFilter]);

    useEffect(() => {
        loadData();
    }, [currentPage, dateRange, searchTerm, statusFilter, locationFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch sales orders
            let query = supabase.from('sales_orders').select('*', { count: 'exact' });
            
            // 1. Date limits
            if (dateRange === 'today') {
                const today = new Date().toISOString().split('T')[0];
                query = query.or(`order_date.eq.${today},deadline.eq.${today}`);
            } else if (dateRange === '30days') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const limitDate = thirtyDaysAgo.toISOString().split('T')[0];
                query = query.gte('order_date', limitDate);
            }

            // 2. Status filter
            if (statusFilter !== 'All') {
                query = query.eq('status', statusFilter);
            }

            // 3. Location filter
            if (locationFilter !== 'All') {
                query = query.eq('trip_origin', locationFilter);
            }

            // 4. Fuzzy search
            if (searchTerm.trim()) {
                const term = `%${searchTerm.trim()}%`;
                query = query.or(`customer.ilike.${term},order_number.ilike.${term}`);
            }
            
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data: ordersData, count: total, error: ordersErr } = await query
                .order('created_at', { ascending: false })
                .range(from, to);
                
            if (ordersErr) throw ordersErr;
            setOrders(ordersData || []);
            setTotalCount(total || 0);

            // Parallel fetch items, mappings, customers, inventory, and delivery rates
            const [itemsRes, mappingsRes, customersRes, invRes, ratesRes] = await Promise.all([
                getV2Items(),
                supabase.from('customer_sku_mappings').select('*'),
                supabase.from('sys_customers').select('*').order('name'),
                supabase.from('v2_inventory_view').select('sku, loc_id, current_stock'),
                supabase.from('delivery_rates').select('*')
            ]);

            if (itemsRes) setV2Items(itemsRes);
            if (mappingsRes && mappingsRes.data) setSkuMappings(mappingsRes.data);
            if (customersRes && customersRes.data) setSysCustomers(customersRes.data);
            if (ratesRes && ratesRes.data) setDeliveryRates(ratesRes.data);

            if (invRes && invRes.data) {
                const newStockMap: Record<string, Record<string, number>> = {};
                invRes.data.forEach((item: any) => {
                    const sku = item.sku;
                    const locId = (item.loc_id || '').trim().toLowerCase();
                    const stock = Number(item.current_stock) || 0;
                    if (!newStockMap[sku]) newStockMap[sku] = {};
                    // Normalize location id to WAREHOUSES display names
                    const normalized = locId === 'spd' ? 'SPD' : 
                                       (locId === 'nilai' ? 'Nilai' : 
                                       (locId === 'opm_lama' || locId === 'opm lama' ? 'OPM Lama' : 
                                       (locId === 'opm_corner' || locId === 'opm corner' ? 'OPM Corner' : 
                                       (locId === 'opm_ali' || locId === 'opm ali' ? 'OPM Ali' : locId.toUpperCase()))));
                    newStockMap[sku][normalized] = (newStockMap[sku][normalized] || 0) + stock;
                });
                setStockMap(newStockMap);
            }
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    // AI MAPPING ALGORITHM
    const processParsedOrders = (rawOrders: any[], currentMappings: any[], itemsLibrary: V2Item[]) => {
        return rawOrders.map(order => {
            const customerName = (order.customer || '').trim();
            const processedItems = (order.items || []).map((item: any) => {
                const rawName = (item.product || '').trim();
                
                // 1. Check customer alias map
                const mapping = currentMappings.find((m: any) => 
                    m.customer_name.trim().toLowerCase() === customerName.toLowerCase() &&
                    m.raw_product_name.trim().toLowerCase() === rawName.toLowerCase()
                );
                
                let standardName = rawName;
                let standardSku = 'GENERIC-ITEM';
                let isMatched = false;
                
                if (mapping) {
                    standardName = mapping.mapped_product_name;
                    standardSku = mapping.mapped_sku;
                    isMatched = true;
                } else {
                    // 2. Fuzzy match in library
                    const matched = itemsLibrary.find(x => 
                        x.name.toLowerCase().includes(rawName.toLowerCase()) || 
                        x.sku.toLowerCase() === rawName.toLowerCase()
                    );
                    if (matched) {
                        standardName = matched.name;
                        standardSku = matched.sku;
                        isMatched = true;
                    }
                }
                
                return {
                    ...item,
                    rawProductName: rawName,
                    product: standardName,
                    sku: standardSku,
                    isMatched
                };
            });
            return {
                ...order,
                items: processedItems
            };
        });
    };

    // Parse text
    const handleParseAI = async () => {
        if (!whatsappText.trim()) return alert("Please paste WhatsApp order copy or notes.");
        setIsParsing(true);
        try {
            const res = await fetch('/api/agent/parse-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: whatsappText, type: 'sales_order' })
            });
            if (!res.ok) throw new Error("HTTP error " + res.status);
            const data = await res.json();
            if (data && Array.isArray(data)) {
                const processed = processParsedOrders(data, skuMappings, v2Items);
                setParsedOrdersReview(processed);
                setShowReviewModal(true);
            } else {
                alert("Could not identify valid orders. Please check your text format.");
            }
        } catch (err: any) {
            alert("AI parse failed: " + err.message);
        } finally {
            setIsParsing(false);
        }
    };

    // Save AI Orders
    const handleSaveParsedOrders = async () => {
        try {
            for (const order of parsedOrdersReview) {
                const orderNum = `SO-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
                const orderZoneVal = (order as any).zone || determineState((order as any).deliveryAddress || '');
                
                const tempItems = ((order as any).items || []).map((item: any) => {
                    const matched = v2Items.find(x => x.sku === item.sku);
                    return {
                        product: item.product,
                        sku: item.sku || 'GENERIC-ITEM',
                        quantity: Number(item.quantity) || 1,
                        remark: item.remark || "",
                        packaging: matched ? (matched.uom || 'Unit') : 'Unit'
                    };
                });

                const bestFactory = findBestFactory(orderZoneVal || 'Other', tempItems, stockMap);
                const finalFactoryId = bestFactory?.id || 'SPD';

                const finalizedItems = tempItems.map((it: any) => ({
                    ...it,
                    sourceLocation: finalFactoryId
                }));

                const { error: orderErr } = await supabase
                    .from('sales_orders')
                    .insert({
                        order_number: orderNum,
                        customer: (order as any).customer || t('Unknown Customer (WhatsApp)'),
                        delivery_address: (order as any).deliveryAddress || "",
                        deadline: (order as any).deadline || orderDeadline,
                        notes: (order as any).notes || "",
                        status: 'Pending',
                        trip_origin: finalFactoryId,
                        zone: orderZoneVal,
                        trip_drop_count: 1,
                        factory_id: finalFactoryId,
                        items: finalizedItems
                    });

                if (orderErr) throw orderErr;

                // Auto-Learning memory
                if ((order as any).items && Array.isArray((order as any).items)) {
                    for (const item of (order as any).items) {
                        const rawName = item.rawProductName || item.product;
                        const finalSku = item.sku;
                        
                        if (finalSku && finalSku !== 'GENERIC-ITEM' && rawName && (order as any).customer) {
                            const matchedProd = v2Items.find(x => x.sku === finalSku);
                            if (matchedProd) {
                                try {
                                    await supabase.from('customer_sku_mappings').upsert({
                                        customer_name: (order as any).customer.trim(),
                                        raw_product_name: rawName.trim(),
                                        mapped_sku: finalSku,
                                        mapped_product_name: matchedProd.name,
                                        updated_at: new Date().toISOString()
                                    }, {
                                        onConflict: 'customer_name,raw_product_name'
                                    });
                                } catch (upsertErr) {
                                    console.error("Upsert mapping failed:", upsertErr);
                                }
                            }
                        }
                    }
                }
            }

            setWhatsappText('');
            setShowReviewModal(false);
            setParsedOrdersReview([]);
            setShowAIConsole(false);
            await loadData();
            alert("Orders imported and saved to pending pool!");
        } catch (err: any) {
            alert("Failed to save orders: " + err.message);
        }
    };

    // MANUAL CRUD HANDLERS
    const handleOpenCreateModal = (order: any = null) => {
        if (order) {
            setEditingOrder(order);
            setOrderCustomer(order.customer || '');
            setOrderDate(order.order_date || '');
            setOrderDeadline(order.deadline || '');
            setDeliveryAddress(order.delivery_address || '');
            setOrderNotes(order.notes || '');
            setOrderItems(order.items || []);
            setProductSearchQuery('');
            setShowProductDropdown(false);
        } else {
            setEditingOrder(null);
            setOrderCustomer('');
            setOrderDate(new Date().toISOString().split('T')[0]);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setOrderDeadline(tomorrow.toISOString().split('T')[0]);
            setDeliveryAddress('');
            setOrderNotes('');
            setOrderItems([]);
            setProductSearchQuery('');
            setShowProductDropdown(false);
        }
        setIsCreateModalOpen(true);
    };

    const handleAddManualItem = () => {
        if (!selectedItemSku) return alert("Please search and select a product first.");
        const matched = v2Items.find(x => x.sku === selectedItemSku);
        if (!matched) return;

        const newItem = {
            product: matched.name,
            sku: matched.sku,
            quantity: Number(newItemQty) || 1,
            remark: newItemRemark,
            packaging: matched.uom || 'Roll'
        };

        setOrderItems(prev => [...prev, newItem]);
        setSelectedItemSku('');
        setProductSearchQuery('');
        setNewItemQty(0);
        setNewItemRemark('');
    };

    const handleRemoveManualItem = (index: number) => {
        setOrderItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveManualOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderCustomer.trim()) return alert("Customer Name is required.");
        if (orderItems.length === 0) return alert("Please add at least one item.");

        setIsSubmitting(true);
        try {
            const doNumber = editingOrder?.order_number || `SO-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
            
            // 1. Auto-Parse Zone based on address
            const calculatedZone = determineState(deliveryAddress || '');
            
            // 2. Auto-Determine Best Factory Location based on Zone & Stock
            const bestFactory = findBestFactory(calculatedZone, orderItems, stockMap);
            const finalFactoryId = bestFactory?.id || 'SPD'; // Fallback to Taiping (SPD)

            // 3. Batch apply source location to all items
            const finalizedItems = orderItems.map(it => ({
                ...it,
                sourceLocation: finalFactoryId
            }));

            const payload: any = {
                order_number: doNumber,
                customer: orderCustomer.trim(),
                delivery_address: deliveryAddress,
                zone: calculatedZone,
                trip_origin: finalFactoryId,
                trip_drop_count: 1, // Default drop count is 1
                factory_id: finalFactoryId,
                items: finalizedItems,
                order_date: orderDate,
                deadline: orderDeadline || null,
                notes: orderNotes
            };

            if (editingOrder) {
                const { error } = await supabase.from('sales_orders').update(payload).eq('id', editingOrder.id);
                if (error) throw error;
                alert("Order Updated successfully!");
            } else {
                payload.status = 'Pending';
                const { error } = await supabase.from('sales_orders').insert(payload);
                if (error) throw error;

                // Auto-save customer info
                const existing = sysCustomers.find(c => c.name.toLowerCase() === orderCustomer.trim().toLowerCase());
                if (!existing && deliveryAddress) {
                    try {
                        await supabase.from('sys_customers').insert({
                            name: orderCustomer.trim(),
                            address: deliveryAddress
                        });
                    } catch (e) {
                        console.warn("Failed to auto-save customer:", e);
                    }
                }
                alert("Order Created successfully!");
            }

            // Auto-Push Unlisted Zone Category to HR Payroll Rates
            if (calculatedZone && calculatedZone !== 'Other') {
                const getSafeOrigin = (o: string) => (o || '').toUpperCase().trim();
                const categoryExists = deliveryRates.some(r => getSafeOrigin(r.origin) === getSafeOrigin(finalFactoryId) && r.location_name.toLowerCase() === calculatedZone.toLowerCase());
                if (!categoryExists) {
                    try {
                        await supabase.from('delivery_rates').insert({
                            origin: finalFactoryId,
                            location_name: calculatedZone,
                            base_rate: 0,
                            max_places: 1,
                            extra_rate_per_place: 0,
                            notes: "Auto-imported from address parsing."
                        });
                    } catch (e) {
                        console.warn("Failed to auto-push rate:", e);
                    }
                }
            }

            setIsCreateModalOpen(false);
            await loadData();
        } catch (err: any) {
            alert("Save Order failed: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteOrder = async (id: string, orderNum: string) => {
        if (!confirm(`Are you sure you want to delete order "${orderNum}"?`)) return;
        try {
            const { error } = await supabase.from('sales_orders').delete().eq('id', id);
            if (error) throw error;
            await loadData();
            alert("Order deleted successfully!");
        } catch (err: any) {
            alert("Delete failed: " + err.message);
        }
    };

    // Filter Logic
    const filteredOrders = orders.filter(o => {
        const query = searchTerm.toLowerCase();
        const matchesSearch = (o.customer || '').toLowerCase().includes(query) ||
                              (o.order_number || '').toLowerCase().includes(query) ||
                              o.items?.some((i: any) => (i.product || '').toLowerCase().includes(query) || (i.sku || '').toLowerCase().includes(query));
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        const matchesLoc = locationFilter === 'All' || o.trip_origin === locationFilter;
        return matchesSearch && matchesStatus && matchesLoc;
    });

    return (
        <div className="min-h-screen bg-slate-950 text-gray-100 font-sans selection:bg-cyan-500/30">
            {/* Grid bg */}
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            <div className="relative p-6 max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Truck className="text-cyan-400" />
                            Sales Orders <span className="text-xs text-slate-500 font-normal font-mono">v1.2</span>
                        </h1>
                        <p className="text-slate-500 text-xs mt-1">Manage delivery orders, import via AI, and route preparing.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAIConsole(!showAIConsole)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${showAIConsole ? 'bg-green-600/10 border-green-500/30 text-green-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            <Sparkles size={14} /> AI WhatsApp Import
                        </button>
                        <button
                            onClick={() => handleOpenCreateModal()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-lg text-white shadow-[0_0_12px_rgba(37,99,235,0.25)] transition-all cursor-pointer flex items-center gap-1"
                        >
                            <Plus size={14} /> New Order
                        </button>
                    </div>
                </div>

                {/* AI Import Console */}
                {showAIConsole && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-top-4 duration-250">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-green-400 animate-pulse" size={16} />
                                <h3 className="text-xs uppercase font-bold text-white tracking-wider">AI WhatsApp Import Terminal</h3>
                            </div>
                        </div>
                        <textarea
                            className="w-full h-40 bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs font-mono text-green-400 outline-none focus:border-green-500/50 resize-none shadow-inner"
                            placeholder="Example format:
DIY
06/19/2026
oren 15 rolls
single layer black 2 rolls
address: Lot 123 Jalan Nilai..."
                            value={whatsappText}
                            onChange={(e) => setWhatsappText(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setWhatsappText(''); setShowAIConsole(false); }}
                                className="bg-slate-800 hover:bg-slate-705 text-slate-350 text-xs py-1.5 px-4 rounded-lg font-bold transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleParseAI}
                                disabled={isParsing}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 px-5 rounded-lg font-bold shadow-lg shadow-green-950/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                {isParsing ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                {isParsing ? 'AI Parsing...' : 'Parse WhatsApp Text'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/40 p-4 border border-slate-850 rounded-xl">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Order #, Customer, Product..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-xs"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                        {/* Location filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Warehouse:</span>
                            <select
                                value={locationFilter}
                                onChange={e => setLocationFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 outline-none cursor-pointer"
                            >
                                <option value="All">All Locations</option>
                                <option value="SPD">SPD</option>
                                <option value="NILAI">NILAI</option>
                                <option value="KELANTAN">KELANTAN</option>
                                <option value="JOHOR">JOHOR</option>
                            </select>
                        </div>
                        {/* Status filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Status:</span>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-300 outline-none cursor-pointer"
                            >
                                <option value="All">All Status</option>
                                <option value="Pending">{t('Pending')}</option>
                                <option value="Loading">{t('Loading')}</option>
                                <option value="En-Route">{t('En-Route (delivering)')}</option>
                                <option value="Delivered">{t('Delivered')}</option>
                            </select>
                        </div>
                        {/* Date limits */}
                        <div className="flex bg-slate-950 border border-slate-800 rounded p-0.5">
                            {(['30days', 'today', 'all'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setDateRange(mode)}
                                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${dateRange === mode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {mode === '30days' ? 'Last 30 Days' : mode === 'today' ? 'Today' : 'All time'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Orders Main List */}
                <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="p-16 text-center text-slate-500 animate-pulse font-bold text-sm">
                            Fetching Sales Orders blueprint database...
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-16 text-center text-slate-500 text-sm font-semibold">
                            No sales orders matched the filter criteria.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-950/70 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                                        <th className="p-4">Order Details</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Delivery Address</th>
                                        <th className="p-4">{t('Items (product name)')}</th>
                                        <th className="p-4 text-right">{t('Qty (Quantity)')}</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850/60 font-semibold">
                                    {filteredOrders.map(order => (
                                        <tr key={order.id} className="hover:bg-slate-850/20 transition-colors">
                                            {/* Order Num & Dates */}
                                            <td className="p-4 space-y-1">
                                                <div className="text-white font-bold font-mono tracking-tight text-sm">{order.order_number}</div>
                                                <div className="flex gap-2 text-[10px] text-slate-400">
                                                    <span className="flex items-center gap-1"><Calendar size={10} /> Order: {order.order_date || '-'}</span>
                                                    <span className="flex items-center gap-1 font-bold text-amber-500"><Calendar size={10} /> Deadline: {order.deadline || '-'}</span>
                                                </div>
                                            </td>
                                            {/* Customer */}
                                            <td className="p-4">
                                                <div className="text-slate-200 font-bold">{order.customer}</div>
                                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                                    {order.trip_origin}
                                                </span>
                                            </td>
                                            {/* Address & Notes */}
                                            <td className="p-4 max-w-xs">
                                                <p className="text-slate-350 line-clamp-2">{order.delivery_address || 'No Address Provided'}</p>
                                                {order.notes && <p className="text-amber-400/80 text-[10px] italic mt-1 line-clamp-1">Notes: {order.notes}</p>}
                                            </td>
                                            {/* Items */}
                                            <td className="p-4 space-y-1 max-w-xs">
                                                {order.items?.map((item: any, idx: number) => (
                                                    <div key={idx} className="h-5 flex items-center text-slate-300 truncate" title={`${item.product} (${item.sku})`}>
                                                        <span className="truncate">{item.product}</span>
                                                        {item.remark && (
                                                            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-black font-mono ml-2 shrink-0">
                                                                {item.remark}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!order.items || order.items.length === 0) && <div className="text-slate-500 font-normal">-</div>}
                                            </td>
                                            {/* Qty */}
                                            <td className="p-4 space-y-1 text-right">
                                                {order.items?.map((item: any, idx: number) => (
                                                    <div key={idx} className="h-5 flex items-center justify-end text-cyan-400 font-bold font-mono">
                                                        {item.quantity} <span className="text-[9px] text-slate-500 font-normal ml-1 font-sans">{item.packaging || 'Unit'}</span>
                                                    </div>
                                                ))}
                                                {(!order.items || order.items.length === 0) && <div className="text-slate-500 font-normal">-</div>}
                                            </td>
                                            {/* Status */}
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                    order.status === 'Delivered' ? 'bg-green-950/30 text-green-400 border-green-500/20' :
                                                    order.status === 'En-Route' ? 'bg-blue-950/30 text-blue-400 border-blue-500/20' :
                                                    order.status === 'Loading' ? 'bg-purple-950/30 text-purple-400 border-purple-500/20' :
                                                    'bg-slate-950 text-slate-400 border-slate-800'
                                                }`}>
                                                    {order.status || 'Pending'}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="p-4 text-center">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => handleOpenCreateModal(order)}
                                                        className="p-1.5 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                                        title="Edit Order"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id, order.order_number)}
                                                        disabled={order.status && order.status !== 'Pending' && order.status !== 'New'}
                                                        className="p-1.5 text-red-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Delete Order"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalCount > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 border border-slate-850 px-6 py-4 rounded-2xl text-xs font-semibold gap-4 shadow-xl">
                        <div className="text-slate-400 font-medium">
                            Showing <span className="text-white font-bold font-mono">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-white font-bold font-mono">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="text-white font-bold font-mono">{totalCount}</span> orders
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || loading}
                                className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 text-slate-300 hover:text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-slate-400 font-medium">
                                Page <span className="text-cyan-400 font-bold font-mono">{currentPage}</span> of <span className="text-white font-bold font-mono">{Math.ceil(totalCount / pageSize) || 1}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
                                disabled={currentPage === Math.ceil(totalCount / pageSize) || loading}
                                className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 text-slate-300 hover:text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MANUAL CREATE/EDIT MODAL --- */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-bold">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in-95 duration-250">
                        <form onSubmit={handleSaveManualOrder} className="h-full flex flex-col overflow-hidden">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Package className="text-blue-500" size={18} />
                                    {editingOrder ? `Edit Sales Order (${editingOrder.order_number})` : 'Create New Sales Order'}
                                </h3>
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-850 cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto flex-1 text-xs">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    {/* Left Column: Core Order Fields (5/12) */}
                                    <div className="lg:col-span-5 space-y-4">
                                        {/* Customer */}
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 block">{t('Customer Name*')}</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. DIY"
                                                value={orderCustomer}
                                                onChange={e => setOrderCustomer(e.target.value)}
                                                className="w-full bg-gray-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        {/* Dates */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Order Date */}
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 block">{t('Order Date')}</label>
                                                <input
                                                    type="date"
                                                    value={orderDate}
                                                    onChange={e => setOrderDate(e.target.value)}
                                                    className="w-full bg-gray-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                            {/* Deadline Date */}
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 block">{t('Delivery Deadline')}</label>
                                                <input
                                                    type="date"
                                                    value={orderDeadline}
                                                    onChange={e => setOrderDeadline(e.target.value)}
                                                    className="w-full bg-gray-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 block">{t('Delivery Address')}</label>
                                            <textarea
                                                className="w-full h-24 bg-gray-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 resize-none font-medium"
                                                placeholder="Enter full delivery location..."
                                                value={deliveryAddress}
                                                onChange={e => setDeliveryAddress(e.target.value)}
                                            />
                                        </div>

                                        {/* Order Notes */}
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 block">{t('Batch Notes')}</label>
                                            <textarea
                                                placeholder="Any overall notes for driver or dispatch..."
                                                value={orderNotes}
                                                onChange={e => setOrderNotes(e.target.value)}
                                                className="w-full h-20 bg-gray-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Items Builder & Table (7/12) */}
                                    <div className="lg:col-span-7 space-y-4 lg:border-l lg:border-slate-800/80 lg:pl-8">
                                        {/* Items builder */}
                                        <div className="border border-slate-800/80 rounded-xl p-4 space-y-3 bg-slate-950/40">
                                            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-1.5">{t('Order Items Builder (Add order items)')}</h4>
                                            
                                            <div className="flex flex-wrap gap-3 items-end">
                                                <div className="flex-1 min-w-[200px] relative">
                                                    <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">{t('Choose Product (Search and select main library product)*')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Type to search SKU or Name..."
                                                        value={productSearchQuery}
                                                        onFocus={() => setShowProductDropdown(true)}
                                                        onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                                                        onChange={e => {
                                                            setProductSearchQuery(e.target.value);
                                                            setSelectedItemSku(''); // Reset SKU key until option is clicked
                                                            setShowProductDropdown(true);
                                                        }}
                                                        className="w-full bg-gray-950 border border-slate-800 rounded p-2 text-amber-400 font-mono outline-none placeholder-slate-650 focus:border-blue-500"
                                                    />
                                                    {/* Search Dropdown */}
                                                    {showProductDropdown && (
                                                        <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-50 divide-y divide-slate-800/60">
                                                            {v2Items
                                                                .filter(prod => {
                                                                    const q = productSearchQuery.toLowerCase();
                                                                    return (prod.name || '').toLowerCase().includes(q) || (prod.sku || '').toLowerCase().includes(q);
                                                                })
                                                                .slice(0, 30) // Limit display to top 30 matching products for speed
                                                                .map(prod => (
                                                                    <button
                                                                        key={prod.sku}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedItemSku(prod.sku);
                                                                            setProductSearchQuery(`${prod.name} (${prod.sku})`);
                                                                            setShowProductDropdown(false);
                                                                        }}
                                                                        className="w-full text-left p-2.5 text-[11px] hover:bg-blue-900/25 text-slate-200 hover:text-white transition-colors cursor-pointer flex justify-between font-mono"
                                                                    >
                                                                        <span className="font-bold truncate text-slate-300">{prod.name}</span>
                                                                        <span className="text-amber-500 shrink-0 font-bold ml-2">{prod.sku}</span>
                                                                    </button>
                                                                ))
                                                            }
                                                            {v2Items.filter(prod => {
                                                                const q = productSearchQuery.toLowerCase();
                                                                return (prod.name || '').toLowerCase().includes(q) || (prod.sku || '').toLowerCase().includes(q);
                                                            }).length === 0 && (
                                                                <div className="p-3 text-slate-500 text-center text-[10px]">No matching products found</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-20">
                                                    <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">{t('Quantity')}</label>
                                                    <input
                                                        type="number"
                                                        value={newItemQty}
                                                        onChange={e => setNewItemQty(Number(e.target.value))}
                                                        className="w-full bg-gray-950 border border-slate-800 rounded p-2 text-white text-right font-mono"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-[120px]">
                                                    <label className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">{t('Remarks')}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. urgent"
                                                        value={newItemRemark}
                                                        onChange={e => setNewItemRemark(e.target.value)}
                                                        className="w-full bg-gray-950 border border-slate-800 rounded p-2 text-white"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAddManualItem}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold cursor-pointer transition-colors"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>

                                        {/* Item table */}
                                        <div className="border border-slate-850 rounded-lg overflow-hidden bg-slate-950">
                                            <table className="w-full text-left border-collapse text-[11px]">
                                                <thead>
                                                    <tr className="bg-slate-900 border-b border-slate-850 text-slate-400 font-bold">
                                                        <th className="p-2">Product Name</th>
                                                        <th className="p-2">SKU</th>
                                                        <th className="p-2 text-right">Qty</th>
                                                        <th className="p-2">Remark</th>
                                                        <th className="p-2 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-850">
                                                    {orderItems.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="p-4 text-center text-slate-600">No items added to builder yet.</td>
                                                        </tr>
                                                    ) : (
                                                        orderItems.map((it, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-900/40">
                                                                <td className="p-2 text-white font-medium">{it.product}</td>
                                                                <td className="p-2 font-mono text-slate-400">{it.sku}</td>
                                                                <td className="p-2 text-right font-mono text-cyan-400 font-bold">{it.quantity}</td>
                                                                <td className="p-2 text-amber-400 italic">{it.remark || '-'}</td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveManualItem(idx)}
                                                                        className="text-red-500 hover:text-red-400 font-bold"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-3 font-bold">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs py-1.5 px-4 rounded-lg border border-slate-700 transition-colors cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 px-5 rounded-lg shadow-lg transition-all cursor-pointer disabled:opacity-50">
                                    {isSubmitting ? 'Saving...' : 'Save Order'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- AI PARSER REVIEW MODAL --- */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-bold">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Sparkles className="text-green-400" size={18} /> Review AI Extracted Orders ({parsedOrdersReview.length})
                            </h3>
                            <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-850 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto space-y-4 flex-1">
                            {parsedOrdersReview.map((order: any, idx: number) => (
                                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <input
                                            type="text"
                                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sm font-bold text-white w-2/3"
                                            value={order.customer}
                                            onChange={e => {
                                                const updated = [...parsedOrdersReview];
                                                updated[idx].customer = e.target.value;
                                                setParsedOrdersReview(updated);
                                            }}
                                        />
                                        <input
                                            type="date"
                                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono"
                                            value={order.deadline}
                                            onChange={e => {
                                                const updated = [...parsedOrdersReview];
                                                updated[idx].deadline = e.target.value;
                                                setParsedOrdersReview(updated);
                                            }}
                                        />
                                    </div>
                                    <textarea
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-350 outline-none focus:border-blue-500"
                                        value={order.deliveryAddress}
                                        onChange={e => {
                                            const updated = [...parsedOrdersReview];
                                            updated[idx].deliveryAddress = e.target.value;
                                            setParsedOrdersReview(updated);
                                        }}
                                    />
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Items:</div>
                                        {order.items?.map((item: any, i: number) => (
                                            <div key={i} className="bg-slate-900/30 border border-slate-800/40 p-2.5 rounded-lg flex flex-col gap-2">
                                                <div className="flex gap-2 items-center w-full">
                                                    <div className="flex-1 flex flex-col gap-1">
                                                        <input
                                                            type="text"
                                                            className={`bg-slate-900 border rounded px-2.5 py-1 text-xs font-semibold ${item.isMatched ? 'border-slate-850 text-slate-200 focus:border-blue-500' : 'border-red-500/50 text-red-300 focus:border-red-500'}`}
                                                            value={item.product}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const matched = v2Items.find(x => x.name.toLowerCase().includes(val.toLowerCase()) || x.sku.toLowerCase() === val.toLowerCase());
                                                                const updated = [...parsedOrdersReview];
                                                                updated[idx].items[i].product = val;
                                                                if (matched) {
                                                                    updated[idx].items[i].sku = matched.sku;
                                                                    updated[idx].items[i].isMatched = true;
                                                                } else {
                                                                    updated[idx].items[i].sku = 'GENERIC-ITEM';
                                                                    updated[idx].items[i].isMatched = false;
                                                                }
                                                                setParsedOrdersReview(updated);
                                                            }}
                                                        />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="w-16 bg-slate-900 border border-slate-850 rounded px-2.5 py-1 text-xs text-white text-right font-bold font-mono focus:border-blue-500"
                                                        value={item.quantity}
                                                        onChange={e => {
                                                            const updated = [...parsedOrdersReview];
                                                            updated[idx].items[i].quantity = Number(e.target.value);
                                                            setParsedOrdersReview(updated);
                                                        }}
                                                    />
                                                </div>
                                                {!item.isMatched && (
                                                    <div className="flex flex-col sm:flex-row gap-1.5 items-start sm:items-center text-[10px] text-red-400 font-bold bg-red-950/20 px-2 py-1 rounded border border-red-500/10">
                                                        <span className="shrink-0">{t('❌ This product is not in the library, please specify related products:')}</span>
                                                        <select
                                                            className="bg-slate-950 border border-slate-800 text-[10px] text-amber-400 font-mono rounded px-2 py-0.5 max-w-xs outline-none cursor-pointer"
                                                            value={item.sku || 'GENERIC-ITEM'}
                                                            onChange={e => {
                                                                const selectedSku = e.target.value;
                                                                const selectedProd = v2Items.find(x => x.sku === selectedSku);
                                                                const updated = [...parsedOrdersReview];
                                                                if (selectedProd) {
                                                                    updated[idx].items[i].product = selectedProd.name;
                                                                    updated[idx].items[i].sku = selectedSku;
                                                                    updated[idx].items[i].isMatched = true;
                                                                } else {
                                                                    updated[idx].items[i].product = item.rawProductName || item.product;
                                                                    updated[idx].items[i].sku = 'GENERIC-ITEM';
                                                                    updated[idx].items[i].isMatched = false;
                                                                }
                                                                setParsedOrdersReview(updated);
                                                            }}
                                                        >
                                                            <option value="GENERIC-ITEM">{t('--Select Standard Library Products --')}</option>
                                                            {v2Items.map(prod => (
                                                                <option key={prod.sku} value={prod.sku}>
                                                                    {prod.name} ({prod.sku})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-3 font-bold">
                            <button onClick={() => setShowReviewModal(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-355 text-xs py-2 px-4 rounded-xl border border-slate-700 transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleSaveParsedOrders} className="bg-green-600 hover:bg-green-500 text-white text-xs py-2 px-5 rounded-xl shadow-lg shadow-green-950/30 transition-all flex items-center gap-1.5 cursor-pointer">
                                <CheckCircle size={14} /> Import All ({parsedOrdersReview.length} Orders)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
