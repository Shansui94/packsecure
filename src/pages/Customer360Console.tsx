import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { 
    Search, User, MapPin, Compass, Phone, Mail, 
    Calendar, Clipboard, Clock, CheckCircle, Truck, 
    ArrowRight, Star, RefreshCw, AlertCircle, FileText 
} from 'lucide-react';

interface Customer {
    id: string;
    name: string;
    address?: string;
    zone?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    email?: string;
}

interface AliasMapping {
    id: string;
    customer_name: string;
    raw_product_name: string;
    mapped_product_name: string;
    mapped_sku: string;
    updated_at: string;
}

interface SalesOrderItem {
    product: string;
    sku?: string;
    quantity: number;
    remark?: string;
}

interface SalesOrder {
    id: string;
    order_number: string;
    customer: string;
    items: SalesOrderItem[];
    status: 'New' | 'Planned' | 'In-Production' | 'Ready-to-Ship' | 'Shipped' | 'Loaded' | 'Delivered' | 'Cancelled' | 'Pending Approval';
    order_date: string;
    deadline: string;
    notes?: string;
    driver_name?: string;
    delivery_address?: string;
    zone?: string;
}

export default function Customer360Console() {
    const { t } = useTranslation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const [mappings, setMappings] = useState<AliasMapping[]>([]);
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isCustomersLoading, setIsCustomersLoading] = useState(true);

    // Fetch customers on mount
    useEffect(() => {
        async function fetchCustomers() {
            try {
                const { data, error } = await supabase
                    .from('sys_customers')
                    .select('*')
                    .order('name');
                if (error) throw error;
                setCustomers(data || []);
            } catch (err) {
                console.error('Error fetching customers:', err);
            } finally {
                setIsCustomersLoading(false);
            }
        }
        fetchCustomers();
    }, []);

    // Filter customers for dropdown
    const filteredCustomers = useMemo(() => {
        if (!searchQuery) return customers;
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, customers]);

    // Fetch related details when customer is selected
    useEffect(() => {
        if (!selectedCustomer) {
            setMappings([]);
            setOrders([]);
            return;
        }

        async function fetchCustomerDetails() {
            setIsLoading(true);
            try {
                // 1. Fetch alias mappings
                const { data: mappingData, error: mappingErr } = await supabase
                    .from('customer_sku_mappings')
                    .select('*')
                    .eq('customer_name', selectedCustomer.name);
                
                if (mappingErr) throw mappingErr;
                setMappings(mappingData || []);

                // 2. Fetch sales orders (latest 5)
                const { data: orderData, error: orderErr } = await supabase
                    .from('sales_orders')
                    .select('*')
                    .eq('customer', selectedCustomer.name)
                    .order('order_date', { ascending: false })
                    .limit(5);

                if (orderErr) throw orderErr;
                
                // Mapped correctly database naming to interface
                const formattedOrders = (orderData || []).map((o: any) => ({
                    id: o.id,
                    order_number: o.order_number,
                    customer: o.customer,
                    items: o.items || [],
                    status: o.status,
                    order_date: o.order_date,
                    deadline: o.deadline,
                    notes: o.notes,
                    driver_name: o.driver_name || o.driver_id || '未指派司机',
                    delivery_address: o.delivery_address,
                    zone: o.zone
                }));
                setOrders(formattedOrders);

            } catch (err) {
                console.error('Error fetching customer details:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchCustomerDetails();
    }, [selectedCustomer]);

    // Status Badge Helpers
    const getStatusStyle = (status: SalesOrder['status']) => {
        switch (status) {
            case 'Delivered':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
            case 'Shipped':
            case 'Loaded':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
            case 'Planned':
            case 'In-Production':
            case 'Ready-to-Ship':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
            case 'Cancelled':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
            default:
                return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25';
        }
    };

    return (
        <div className="flex-1 bg-[#09090b] min-h-screen text-gray-100 flex flex-col p-6 font-sans">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 tracking-tight flex items-center gap-2">
                        <Star className="text-green-400 fill-green-400" size={26} />
                        CUSTOMER 360 CONSOLE
                    </h1>
                    <p className="text-xs text-gray-500 font-mono mt-1">{t('一站式客户资料与配送单据全景透视工作台')}</p>
                </div>
            </div>

            {/* Top Selector Panel */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 relative z-30">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('选择要查看的客户')}</label>
                <div className="relative w-full max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-3 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder={isCustomersLoading ? t('正在载入客户列表...') : t('搜索客户名字...')}
                            disabled={isCustomersLoading}
                            value={selectedCustomer ? selectedCustomer.name : searchQuery}
                            onFocus={() => {
                                setIsDropdownOpen(true);
                                if (selectedCustomer) {
                                    setSearchQuery('');
                                    setSelectedCustomer(null);
                                }
                            }}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#121214] border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-zinc-600 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"
                        />
                        {selectedCustomer && (
                            <button 
                                onClick={() => {
                                    setSelectedCustomer(null);
                                    setSearchQuery('');
                                }}
                                className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-white bg-zinc-800/80 px-2 py-1 rounded-md transition-colors"
                            >
                                {t('清除')}
                            </button>
                        )}
                    </div>

                    {isDropdownOpen && !isCustomersLoading && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-[#121214] border border-zinc-850 rounded-xl max-h-60 overflow-y-auto shadow-2xl z-50">
                            {filteredCustomers.length === 0 ? (
                                <div className="p-4 text-xs text-zinc-600 text-center">{t('未找到匹配客户')}</div>
                            ) : (
                                filteredCustomers.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedCustomer(c);
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-green-500/10 hover:text-green-400 border-b border-zinc-900 last:border-0 transition-colors"
                                    >
                                        {c.name}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Workbench */}
            {!selectedCustomer ? (
                <div className="flex-1 border border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center p-12 text-center bg-zinc-950/20">
                    <User size={48} className="text-zinc-700 mb-4 animate-pulse" />
                    <h3 className="font-bold text-zinc-400 text-sm">{t('暂无数据')}</h3>
                    <p className="text-xs text-zinc-600 max-w-xs mt-1">{t('请在上方选择或搜索客户')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Column (Profile & Alias) */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Box 1: Customer Profile */}
                        <div className="bg-[#121214] border border-zinc-850 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                                <User size={120} className="text-white" />
                            </div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-zinc-800 flex items-center gap-2">
                                <User className="text-green-400" size={16} />
                                客户资料卡 (Profile)
                            </h2>
                            <div className="space-y-4 text-xs">
                                <div>
                                    <label className="text-zinc-500 block mb-1">客户名称</label>
                                    <div className="text-white font-bold text-sm bg-zinc-900/50 p-2 rounded-lg border border-zinc-850">{selectedCustomer.name}</div>
                                </div>
                                
                                <div>
                                    <label className="text-zinc-500 block mb-1">送货地址</label>
                                    <div className="text-zinc-300 font-semibold bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850 flex gap-1.5 items-start">
                                        <MapPin className="text-red-400 shrink-0 mt-0.5" size={14} />
                                        <span>{selectedCustomer.address || '暂无录入地址'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-zinc-500 block mb-1">所属物流区域 (Zone)</label>
                                        <div className="text-green-400 font-bold bg-green-500/5 p-2 rounded-lg border border-green-500/10 flex items-center gap-1.5">
                                            <Compass size={14} />
                                            {selectedCustomer.zone || 'TAIPING'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-zinc-500 block mb-1">GPS 坐标</label>
                                        <div className="text-zinc-400 font-mono bg-zinc-900/50 p-2 rounded-lg border border-zinc-850 text-[10px]">
                                            {selectedCustomer.lat && selectedCustomer.lng 
                                                ? `${selectedCustomer.lat.toFixed(5)}, ${selectedCustomer.lng.toFixed(5)}`
                                                : '未定位'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-zinc-500 block mb-1">联系电话</label>
                                        <div className="text-zinc-300 bg-zinc-900/50 p-2 rounded-lg border border-zinc-850 flex items-center gap-1.5">
                                            <Phone size={12} className="text-zinc-500" />
                                            {selectedCustomer.phone || 'N/A'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-zinc-500 block mb-1">电子邮箱</label>
                                        <div className="text-zinc-300 bg-zinc-900/50 p-2 rounded-lg border border-zinc-850 flex items-center gap-1.5 truncate">
                                            <Mail size={12} className="text-zinc-500" />
                                            {selectedCustomer.email || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Box 2: Alias Mapping */}
                        <div className="bg-[#121214] border border-zinc-850 rounded-2xl p-5 shadow-lg">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-zinc-800 flex items-center gap-2">
                                <Clipboard className="text-cyan-400" size={16} />
                                产品别名库对照 (Alias Mapping)
                            </h2>
                            {isLoading ? (
                                <div className="p-8 text-center text-xs text-zinc-500 animate-pulse">正在载入别名库...</div>
                            ) : mappings.length === 0 ? (
                                <div className="p-6 text-center text-xs text-zinc-600 bg-zinc-950/20 border border-zinc-850/50 rounded-xl">
                                    该客户暂无专属别名映射数据。
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                    {mappings.map((m) => (
                                        <div key={m.id} className="bg-zinc-900/60 hover:bg-zinc-900 p-3 rounded-xl border border-zinc-850 flex justify-between items-center gap-4 transition-colors">
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-red-400 font-mono bg-red-950/30 px-2 py-0.5 rounded border border-red-500/10 inline-block mb-1.5">
                                                    “{m.raw_product_name}”
                                                </div>
                                                <p className="text-[11px] text-zinc-300 font-bold truncate">{m.mapped_product_name}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-[10px] font-mono bg-cyan-950/30 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/15">
                                                    {m.mapped_sku}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Column (Sales Orders Status Timeline) */}
                    <div className="lg:col-span-7 space-y-6">
                        
                        {/* Box 3: Recent Orders Timeline */}
                        <div className="bg-[#121214] border border-zinc-850 rounded-2xl p-5 shadow-lg">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 pb-2 border-b border-zinc-800 flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                    <Clock className="text-indigo-400" size={16} />
                                    最新出单状态追踪 (Recent Orders)
                                </span>
                                {isLoading && <RefreshCw size={12} className="animate-spin text-zinc-500" />}
                            </h2>

                            {isLoading ? (
                                <div className="p-12 text-center text-xs text-zinc-500 animate-pulse">正在载入最新单据状态...</div>
                            ) : orders.length === 0 ? (
                                <div className="p-12 text-center text-xs text-zinc-600 bg-zinc-950/20 border border-zinc-850/50 rounded-xl">
                                    最近没有查到该客户的出单记录。
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map((order) => (
                                        <div key={order.id} className="bg-zinc-900/40 border border-zinc-850 hover:border-zinc-800 rounded-xl p-4 transition-all">
                                            
                                            {/* Order Card Header */}
                                            <div className="flex justify-between items-start gap-4 mb-3">
                                                <div>
                                                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                                                        <FileText size={12} className="text-zinc-500" />
                                                        {order.order_number}
                                                    </span>
                                                    <div className="text-[10px] text-zinc-500 flex gap-2 mt-1">
                                                        <span>下单: {order.order_date}</span>
                                                        <span>截止: {order.deadline}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusStyle(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </div>

                                            {/* Order Items List */}
                                            <div className="bg-[#121214] rounded-lg p-2.5 border border-zinc-850/50 mb-3 space-y-1.5">
                                                {order.items && order.items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-[11px] text-zinc-300">
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></span>
                                                            <span className="font-mono font-semibold">{item.sku || item.product}</span>
                                                            {item.remark && (
                                                                <span className="text-[9px] text-zinc-500 bg-zinc-850 px-1 rounded">({item.remark})</span>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-white">{item.quantity} 卷</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Driver & Memo Footer */}
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-zinc-850/50 text-[10px] text-zinc-500">
                                                <div className="flex items-center gap-1">
                                                    <Truck size={12} className="text-zinc-500" />
                                                    <span>司机: <strong className="text-zinc-300">{order.driver_name}</strong></span>
                                                </div>
                                                {order.notes && (
                                                    <div className="bg-zinc-850/50 px-2 py-0.5 rounded text-zinc-400 truncate max-w-xs">
                                                        备注: {order.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                </div>
            )}
        </div>
    );
}
