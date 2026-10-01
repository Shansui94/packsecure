import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Building2,
    FileText,
    Upload,
    Calendar,
    DollarSign,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Sparkles,
    Download,
    Eye,
    Trash2,
    Edit3,
    MessageCircle,
    Search,
    Filter,
    Plus,
    Tag,
    Phone,
    MapPin,
    ExternalLink,
    X,
    ChevronRight,
    RefreshCw,
    ShieldAlert,
    Share2,
    Send,
    Loader2
} from 'lucide-react';
import { TenancyAgreement, TenancyStatus } from '../../types';
import { supabase } from '../../services/supabase';

interface TenancyAgreementFolderProps {
    currentUser?: any;
}

export const TenancyAgreementFolder: React.FC<TenancyAgreementFolderProps> = ({ currentUser }) => {
    // ── States ────────────────────────────────────────────────────────
    const [agreements, setAgreements] = useState<TenancyAgreement[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED'>('ALL');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'expiry_asc' | 'expiry_desc' | 'rent_desc' | 'created_desc'>('expiry_asc');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [editingAgreement, setEditingAgreement] = useState<Partial<TenancyAgreement> | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; type: string } | null>(null);
    const [isWaModalOpen, setIsWaModalOpen] = useState<boolean>(false);
    const [selectedWaAgreement, setSelectedWaAgreement] = useState<TenancyAgreement | null>(null);
    const [waCustomPhone, setWaCustomPhone] = useState<string>('');
    const [waCustomNote, setWaCustomNote] = useState<string>('');
    const [isSendingWa, setIsSendingWa] = useState<boolean>(false);

    // AI Upload & Extract State
    const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
    const [aiProgressStep, setAiProgressStep] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Fetch Agreements ──────────────────────────────────────────────
    const fetchAgreements = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/tenancy-agreements');
            if (res.ok) {
                const data = await res.json();
                setAgreements(data.agreements || []);
                if (data.tableReady !== undefined) {
                    setTableReady(data.tableReady);
                }
            } else {
                console.error('Failed to load tenancy agreements from API');
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAgreements();

        // Realtime subscription if available
        const channel = supabase.channel('tenancy-changes-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tenancy_agreements' }, () => {
                fetchAgreements();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // ── KPI Metrics ───────────────────────────────────────────────────
    const metrics = useMemo(() => {
        let total = agreements.length;
        let active = 0;
        let expiringSoon = 0;
        let expired = 0;
        let totalMonthlyRent = 0;

        agreements.forEach(a => {
            const rent = Number(a.monthly_rent || 0);
            totalMonthlyRent += rent;

            if (a.days_remaining !== undefined) {
                if (a.days_remaining < 0) expired++;
                else if (a.days_remaining <= 60) expiringSoon++;
                else active++;
            } else {
                if (a.status === 'Expired') expired++;
                else if (a.status === 'Expiring_Soon') expiringSoon++;
                else active++;
            }
        });

        return { total, active, expiringSoon, expired, totalMonthlyRent };
    }, [agreements]);

    // ── Unique Categories & Tags ──────────────────────────────────────
    const availableCategories = useMemo(() => {
        const set = new Set<string>();
        agreements.forEach(a => {
            if (a.category && a.category.trim()) set.add(a.category.trim());
        });
        return Array.from(set);
    }, [agreements]);

    // ── Filtered & Sorted Agreements ──────────────────────────────────
    const filteredAgreements = useMemo(() => {
        return agreements.filter(item => {
            // Tab status filter
            if (activeTabFilter === 'ACTIVE') {
                if (item.days_remaining !== undefined) {
                    if (item.days_remaining <= 60) return false;
                } else if (item.status !== 'Active') return false;
            } else if (activeTabFilter === 'EXPIRING') {
                if (item.days_remaining !== undefined) {
                    if (item.days_remaining < 0 || item.days_remaining > 60) return false;
                } else if (item.status !== 'Expiring_Soon') return false;
            } else if (activeTabFilter === 'EXPIRED') {
                if (item.days_remaining !== undefined) {
                    if (item.days_remaining >= 0) return false;
                } else if (item.status !== 'Expired') return false;
            }

            // Category filter
            if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
                return false;
            }

            // Search query (keyword)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = (item.title || '').toLowerCase().includes(q);
                const matchAddress = (item.property_address || '').toLowerCase().includes(q);
                const matchLandlord = (item.landlord_name || '').toLowerCase().includes(q);
                const matchPhone = (item.landlord_phone || '').toLowerCase().includes(q);
                const matchLocation = (item.location_tag || '').toLowerCase().includes(q);
                const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
                if (!matchTitle && !matchAddress && !matchLandlord && !matchPhone && !matchLocation && !matchTags) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'expiry_asc') {
                const remA = a.days_remaining ?? 99999;
                const remB = b.days_remaining ?? 99999;
                return remA - remB;
            }
            if (sortBy === 'expiry_desc') {
                const remA = a.days_remaining ?? -99999;
                const remB = b.days_remaining ?? -99999;
                return remB - remA;
            }
            if (sortBy === 'rent_desc') {
                return (Number(b.monthly_rent) || 0) - (Number(a.monthly_rent) || 0);
            }
            if (sortBy === 'created_desc') {
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            }
            return 0;
        });
    }, [agreements, activeTabFilter, categoryFilter, searchQuery, sortBy]);

    // ── AI Extraction Handler ─────────────────────────────────────────
    const handleFileSelectedForAi = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAiProcessing(true);
        setAiProgressStep('1/3 正在编码与上传文件至存储库...');

        try {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setAiProgressStep('2/3 Google Gemini 2.5 Flash 深度理解租约条款与关键实体...');

            const res = await fetch('/api/agent/parse-tenancy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileBase64: base64Data,
                    mimeType: file.type
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'AI 解析失败');
            }

            setAiProgressStep('3/3 解析完成，自动回填表单...');

            const ext = data.extracted || {};
            setEditingAgreement({
                title: ext.title || file.name.replace(/\.[^/.]+$/, ""),
                category: ext.category || 'General',
                property_address: ext.property_address || '',
                location_tag: ext.location_tag || '',
                landlord_name: ext.landlord_name || '',
                landlord_phone: ext.landlord_phone || '',
                landlord_ic_ssm: ext.landlord_ic_ssm || '',
                start_date: ext.start_date || '',
                end_date: ext.end_date || '',
                monthly_rent: ext.monthly_rent || 0,
                security_deposit: ext.security_deposit || 0,
                utility_deposit: ext.utility_deposit || 0,
                notice_period_months: ext.notice_period_months || 2,
                status: 'Active',
                file_url: data.file_url || '',
                storage_path: data.storage_path || '',
                file_name: data.file_name || file.name,
                tags: ext.tags || [],
                notes: ext.notes || ''
            });

            setIsEditModalOpen(true);
        } catch (err: any) {
            alert('AI 提取失败: ' + err.message);
        } finally {
            setIsAiProcessing(false);
            setAiProgressStep('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Save Agreement ────────────────────────────────────────────────
    const handleSaveAgreement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAgreement || !editingAgreement.title) {
            alert('请填写租约标的名称！');
            return;
        }

        try {
            const res = await fetch('/api/tenancy-agreements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editingAgreement,
                    created_by: currentUser?.name || currentUser?.email || 'Admin'
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || '保存失败');
            }

            setIsEditModalOpen(false);
            setEditingAgreement(null);
            fetchAgreements();
        } catch (err: any) {
            alert('保存租约失败: ' + err.message);
        }
    };

    // ── Delete Agreement ──────────────────────────────────────────────
    const handleDeleteAgreement = async (id: string, title: string) => {
        if (!window.confirm(`确定要彻底删除租约档案【${title}】吗？此操作无法撤销。`)) return;

        try {
            const res = await fetch('/api/tenancy-agreements', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (res.ok) {
                fetchAgreements();
            } else {
                const data = await res.json();
                alert('删除失败: ' + (data.error || '未知错误'));
            }
        } catch (err: any) {
            alert('删除发生错误: ' + err.message);
        }
    };

    // ── Trigger WhatsApp Reminder ─────────────────────────────────────
    const handleSendWhatsAppReminder = async () => {
        if (!selectedWaAgreement) return;
        setIsSendingWa(true);

        try {
            const res = await fetch('/api/tenancy-agreements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'remind',
                    agreementId: selectedWaAgreement.id,
                    targetPhone: waCustomPhone || selectedWaAgreement.landlord_phone,
                    customNote: waCustomNote
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (data.waSent) {
                    alert('✅ 官方 WhatsApp 提醒已成功送达！');
                } else {
                    // Open wa.me link as fallback
                    const targetPhone = (waCustomPhone || selectedWaAgreement.landlord_phone || '').replace(/[^0-9]/g, '');
                    const cleanPhone = targetPhone.startsWith('0') ? `60${targetPhone.slice(1)}` : targetPhone;
                    const encodedMsg = encodeURIComponent(data.reminderMsg || '');
                    window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                }
                setIsWaModalOpen(false);
                setSelectedWaAgreement(null);
                fetchAgreements();
            } else {
                alert('发送提醒失败: ' + (data.error || '未知错误'));
            }
        } catch (err: any) {
            alert('发送失败: ' + err.message);
        } finally {
            setIsSendingWa(false);
        }
    };

    // ── Helper: Format Countdown Badge ────────────────────────────────
    const renderCountdownBadge = (days?: number) => {
        if (days === undefined) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    <Clock size={12} /> 未指定到期日
                </span>
            );
        }

        if (days < 0) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                    <AlertTriangle size={13} /> 已逾期 {Math.abs(days)} 天
                </span>
            );
        }

        if (days <= 30) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                    <AlertTriangle size={13} /> 剩 {days} 天 (紧急续约)
                </span>
            );
        }

        if (days <= 60) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Clock size={13} /> 剩 {days} 天 (到期提醒)
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 size={13} /> 履约中 (还有 {days} 天)
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* ── Top Header & Action Controls ───────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0d0d12] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-purple-600/10 via-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                🏢 租约管理文件夹
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-medium">
                                    Tenancy Repository
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">
                                集中归档管理全厂区厂房、外劳宿舍、办公室及货场租赁合同，支持 Gemini AI 智能提取与到期红绿灯预警。
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    {/* Hidden AI File Upload */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelectedForAi}
                        accept="application/pdf,image/*"
                        className="hidden"
                    />

                    {/* AI Smart Extract Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAiProcessing}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                        title="上传合同 PDF 或拍照，由 Gemini AI 自动解析房东、租金、起止日并自动回填"
                    >
                        {isAiProcessing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>AI 正在解析...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} className="text-amber-300" />
                                <span>AI 上传解析 (Gemini)</span>
                            </>
                        )}
                    </button>

                    {/* Manual Blank Entry Button */}
                    <button
                        onClick={() => {
                            setEditingAgreement({
                                title: '',
                                category: 'General',
                                property_address: '',
                                location_tag: '',
                                landlord_name: '',
                                landlord_phone: '',
                                landlord_ic_ssm: '',
                                start_date: '',
                                end_date: '',
                                monthly_rent: 0,
                                security_deposit: 0,
                                utility_deposit: 0,
                                notice_period_months: 2,
                                status: 'Active',
                                tags: [],
                                notes: ''
                            });
                            setIsEditModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 border border-white/10 transition-all shadow"
                    >
                        <Plus size={16} />
                        <span>空白录入新租约</span>
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={fetchAgreements}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition-all"
                        title="刷新数据"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Database Table Notice Banner */}
            {!tableReady && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                        <div>
                            <h4 className="text-xs font-bold text-amber-300">数据库表就绪提示 (Database Table Setup)</h4>
                            <p className="text-[11px] text-gray-300 mt-0.5">
                                Supabase 尚未创建 <code>public.tenancy_agreements</code> 表。请在 Supabase SQL Editor 执行 <code>scripts/create_tenancy_agreements_table.sql</code> 即可完成初始化。
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText('scripts/create_tenancy_agreements_table.sql');
                            alert('已复制 SQL 脚本相对路径：scripts/create_tenancy_agreements_table.sql');
                        }}
                        className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold shrink-0 transition border border-amber-500/30"
                    >
                        复制脚本路径
                    </button>
                </div>
            )}

            {/* AI Progress Banner */}
            {isAiProcessing && (
                <div className="bg-gradient-to-r from-purple-900/40 via-blue-900/40 to-purple-900/40 border border-purple-500/40 rounded-2xl p-4 flex items-center gap-3 shadow-xl">
                    <Loader2 size={18} className="animate-spin text-purple-400 shrink-0" />
                    <div className="text-xs">
                        <span className="font-bold text-purple-200">AI 智能提取进行中：</span>
                        <span className="text-gray-300 ml-1.5">{aiProgressStep}</span>
                    </div>
                </div>
            )}

            {/* ── KPI Metric Cards ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div 
                    onClick={() => setActiveTabFilter('ALL')}
                    className={`bg-[#0d0d12] border rounded-2xl p-4 cursor-pointer transition-all ${
                        activeTabFilter === 'ALL' ? 'border-purple-500/60 shadow-lg shadow-purple-500/10' : 'border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">全部租约</span>
                        <FileText size={16} className="text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-white mt-2 font-mono">{metrics.total}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">全厂区总归档数</div>
                </div>

                <div 
                    onClick={() => setActiveTabFilter('ACTIVE')}
                    className={`bg-[#0d0d12] border rounded-2xl p-4 cursor-pointer transition-all ${
                        activeTabFilter === 'ACTIVE' ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">履约正常</span>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">{metrics.active}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">&gt; 60 天安全期</div>
                </div>

                <div 
                    onClick={() => setActiveTabFilter('EXPIRING')}
                    className={`bg-[#0d0d12] border rounded-2xl p-4 cursor-pointer transition-all ${
                        activeTabFilter === 'EXPIRING' ? 'border-amber-500/60 shadow-lg shadow-amber-500/10' : 'border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">即将到期</span>
                        <Clock size={16} className="text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-2 font-mono">{metrics.expiringSoon}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">30 ~ 60 天提醒</div>
                </div>

                <div 
                    onClick={() => setActiveTabFilter('EXPIRED')}
                    className={`bg-[#0d0d12] border rounded-2xl p-4 cursor-pointer transition-all ${
                        activeTabFilter === 'EXPIRED' ? 'border-red-500/60 shadow-lg shadow-red-500/10' : 'border-white/5 hover:border-white/20'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">紧急 / 已逾期</span>
                        <AlertTriangle size={16} className="text-red-400" />
                    </div>
                    <div className="text-2xl font-black text-red-400 mt-2 font-mono">{metrics.expired}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">&lt; 30 天或已超期</div>
                </div>

                <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-4">
                    <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">月度租金支出</span>
                        <DollarSign size={16} className="text-blue-400" />
                    </div>
                    <div className="text-2xl font-black text-blue-400 mt-2 font-mono">
                        RM {metrics.totalMonthlyRent.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">每月固定租金总额</div>
                </div>
            </div>

            {/* ── Search, Filters & Sorting Toolbar ───────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0d0d12] border border-white/5 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 flex-1">
                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="搜索标的名称、地址、房东、电话、标签..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="ALL">全部标的类别</option>
                        {availableCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Sort Order */}
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as any)}
                        className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-purple-500/50"
                    >
                        <option value="expiry_asc">⏳ 到期时间由近到远</option>
                        <option value="expiry_desc">⌛ 到期时间由远到近</option>
                        <option value="rent_desc">💰 租金由高到低</option>
                        <option value="created_desc">🆕 最新创建</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-white/[0.03] border border-white/10 rounded-xl p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                viewMode === 'grid' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            卡片视图
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                viewMode === 'table' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            表格视图
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Agreements Content ──────────────────────────────────────── */}
            {isLoading ? (
                <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-purple-500" />
                    <span className="text-xs text-gray-400">正在加载租约档案库...</span>
                </div>
            ) : filteredAgreements.length === 0 ? (
                <div className="bg-[#0d0d12] border border-white/5 rounded-2xl p-16 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-gray-500">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">暂无匹配的租约档案</h4>
                        <p className="text-xs text-gray-400 mt-1 max-w-md">
                            可以通过点击上方的【AI 上传解析】直接丢入租约 PDF/图片，或点击【空白录入新租约】手工登记第一份合同。
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2"
                        >
                            <Sparkles size={14} /> AI 上传解析
                        </button>
                        <button
                            onClick={() => {
                                setEditingAgreement({
                                    title: '',
                                    category: 'General',
                                    property_address: '',
                                    location_tag: '',
                                    landlord_name: '',
                                    landlord_phone: '',
                                    landlord_ic_ssm: '',
                                    start_date: '',
                                    end_date: '',
                                    monthly_rent: 0,
                                    security_deposit: 0,
                                    utility_deposit: 0,
                                    notice_period_months: 2,
                                    status: 'Active',
                                    tags: [],
                                    notes: ''
                                });
                                setIsEditModalOpen(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2"
                        >
                            <Plus size={14} /> 手动空白录入
                        </button>
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── Cards Grid View ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAgreements.map(item => (
                        <div
                            key={item.id}
                            className="bg-[#0d0d12] border border-white/10 hover:border-purple-500/40 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all group relative overflow-hidden"
                        >
                            <div className="space-y-3.5">
                                {/* Title & Countdown Badge */}
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                {item.category || 'General'}
                                            </span>
                                            {item.location_tag && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                    📍 {item.location_tag}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-bold text-white mt-1.5 group-hover:text-purple-300 transition-colors">
                                            {item.title}
                                        </h3>
                                    </div>
                                    <div className="shrink-0">
                                        {renderCountdownBadge(item.days_remaining)}
                                    </div>
                                </div>

                                {/* Address */}
                                {item.property_address && (
                                    <div className="flex items-start gap-1.5 text-xs text-gray-400">
                                        <MapPin size={13} className="text-gray-500 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 leading-relaxed">{item.property_address}</span>
                                    </div>
                                )}

                                {/* Financial Commitment */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 grid grid-cols-3 gap-2">
                                    <div>
                                        <span className="text-[9px] text-gray-500 block font-bold uppercase">月租金</span>
                                        <span className="text-xs font-black text-emerald-400 font-mono">
                                            RM {Number(item.monthly_rent || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-500 block font-bold uppercase">押金</span>
                                        <span className="text-xs font-bold text-gray-300 font-mono">
                                            RM {Number(item.security_deposit || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-gray-500 block font-bold uppercase">水电押金</span>
                                        <span className="text-xs font-bold text-gray-300 font-mono">
                                            RM {Number(item.utility_deposit || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Landlord Info & Lease Dates */}
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between text-gray-400">
                                        <span className="text-gray-500">房东:</span>
                                        <span className="font-medium text-white flex items-center gap-1.5">
                                            {item.landlord_name || '未填写'}
                                            {item.landlord_phone && (
                                                <a 
                                                    href={`tel:${item.landlord_phone}`} 
                                                    className="text-purple-400 hover:text-purple-300 inline-flex items-center"
                                                    title={`拨打电话 ${item.landlord_phone}`}
                                                >
                                                    <Phone size={11} />
                                                </a>
                                            )}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-gray-400">
                                        <span className="text-gray-500">租期起止:</span>
                                        <span className="font-mono text-gray-300">
                                            {item.start_date || '未定'} ~ {item.end_date || '未定'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-gray-400">
                                        <span className="text-gray-500">通知期:</span>
                                        <span className="text-gray-300">
                                            提前 {item.notice_period_months || 2} 个月
                                        </span>
                                    </div>
                                </div>

                                {/* Tags */}
                                {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {item.tags.map((tg, idx) => (
                                            <span key={idx} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/5">
                                                #{tg}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Card Footer Actions */}
                            <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {/* Preview Contract Button */}
                                    {item.file_url ? (
                                        <button
                                            onClick={() => {
                                                const isPdf = (item.file_name || item.file_url || '').toLowerCase().endsWith('.pdf');
                                                setPreviewDoc({
                                                    url: item.file_url!,
                                                    title: item.title,
                                                    type: isPdf ? 'pdf' : 'image'
                                                });
                                                setIsPreviewModalOpen(true);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-purple-500/20"
                                            title="查看原件合同"
                                        >
                                            <Eye size={12} /> 原件
                                        </button>
                                    ) : (
                                        <span className="text-[10px] text-gray-600 italic">无附件</span>
                                    )}

                                    {/* WhatsApp Reminder Button */}
                                    <button
                                        onClick={() => {
                                            setSelectedWaAgreement(item);
                                            setWaCustomPhone(item.landlord_phone || '');
                                            setWaCustomNote('');
                                            setIsWaModalOpen(true);
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-500/20"
                                        title="发送 WhatsApp 续约/到期提醒"
                                    >
                                        <MessageCircle size={12} /> 催办提醒
                                    </button>
                                </div>

                                <div className="flex items-center gap-1">
                                    {/* Edit Button */}
                                    <button
                                        onClick={() => {
                                            setEditingAgreement(item);
                                            setIsEditModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                        title="编辑租约"
                                    >
                                        <Edit3 size={13} />
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDeleteAgreement(item.id, item.title)}
                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                        title="删除租约"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* ── Table View ── */
                <div className="bg-[#0d0d12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/[0.02] text-gray-400 font-bold uppercase tracking-wider border-b border-white/5">
                                <tr>
                                    <th className="py-3 px-4">标的名称 & 类别</th>
                                    <th className="py-3 px-4">到期倒计时</th>
                                    <th className="py-3 px-4">起止日期</th>
                                    <th className="py-3 px-4">月租金 (RM)</th>
                                    <th className="py-3 px-4">房东信息</th>
                                    <th className="py-3 px-4">附件原件</th>
                                    <th className="py-3 px-4 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredAgreements.map(item => (
                                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-white">{item.title}</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                                                <span className="text-purple-400">{item.category || 'General'}</span>
                                                {item.location_tag && <span>• 📍 {item.location_tag}</span>}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {renderCountdownBadge(item.days_remaining)}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-gray-300">
                                            <div>{item.start_date || '-'}</div>
                                            <div className="text-gray-500 text-[10px]">至 {item.end_date || '-'}</div>
                                        </td>
                                        <td className="py-3.5 px-4 font-black font-mono text-emerald-400">
                                            RM {Number(item.monthly_rent || 0).toLocaleString()}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="text-white font-medium">{item.landlord_name || '-'}</div>
                                            <div className="text-gray-500 font-mono text-[10px]">{item.landlord_phone || '-'}</div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {item.file_url ? (
                                                <button
                                                    onClick={() => {
                                                        const isPdf = (item.file_name || item.file_url || '').toLowerCase().endsWith('.pdf');
                                                        setPreviewDoc({
                                                            url: item.file_url!,
                                                            title: item.title,
                                                            type: isPdf ? 'pdf' : 'image'
                                                        });
                                                        setIsPreviewModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-[11px] font-bold"
                                                >
                                                    <Eye size={11} /> 查阅
                                                </button>
                                            ) : (
                                                <span className="text-gray-600 text-[10px]">无</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        setSelectedWaAgreement(item);
                                                        setWaCustomPhone(item.landlord_phone || '');
                                                        setWaCustomNote('');
                                                        setIsWaModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                                    title="发送 WhatsApp 提醒"
                                                >
                                                    <MessageCircle size={13} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingAgreement(item);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                                                    title="编辑"
                                                >
                                                    <Edit3 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgreement(item.id, item.title)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                    title="删除"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Edit / Create Modal ─────────────────────────────────────── */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#12131c] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/30">
                            <div>
                                <h3 className="text-base font-black text-white flex items-center gap-2">
                                    <Building2 size={18} className="text-purple-400" />
                                    {editingAgreement?.id ? '编辑租约合同' : '新增租赁合同档案'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    纯空白自由录入，所有字段均可按实际情况任意填报或打标签。
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditingAgreement(null);
                                }}
                                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body Form */}
                        <form onSubmit={handleSaveAgreement} className="p-6 overflow-y-auto space-y-4 flex-1">
                            {/* Title & Category */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        租约标的名称 <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例如：太平总厂一号仓库 / 宿舍Lot 12"
                                        value={editingAgreement?.title || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        标的分类 (自由定义)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例如：厂房仓库 / 外劳宿舍 / 办公场所 / 货车停车场"
                                        value={editingAgreement?.category || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                            </div>

                            {/* Property Address & Location Tag */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        租用物业完整地址 (Address)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例如：No. 18, Jalan Perusahaan 3, Kamunting Industrial Estate"
                                        value={editingAgreement?.property_address || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, property_address: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        地点标签 (Town/Area)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例如：太平 Taiping / 汝来 Nilai"
                                        value={editingAgreement?.location_tag || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, location_tag: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                            </div>

                            {/* Landlord Info */}
                            <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                                    👤 出租方 (房东) 信息
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">房东姓名/公司名</label>
                                        <input
                                            type="text"
                                            placeholder="Tuan Rumah / Landlord"
                                            value={editingAgreement?.landlord_name || ''}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, landlord_name: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">联系电话 (Phone)</label>
                                        <input
                                            type="text"
                                            placeholder="012-3456789"
                                            value={editingAgreement?.landlord_phone || ''}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, landlord_phone: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">身份证/公司注册号</label>
                                        <input
                                            type="text"
                                            placeholder="IC / SSM No."
                                            value={editingAgreement?.landlord_ic_ssm || ''}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, landlord_ic_ssm: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dates & Periods */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">租约生效起始日</label>
                                    <input
                                        type="date"
                                        value={editingAgreement?.start_date || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        租约届满到期日 <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={editingAgreement?.end_date || ''}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">续约通知期 (月)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="12"
                                        placeholder="2"
                                        value={editingAgreement?.notice_period_months ?? 2}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, notice_period_months: parseInt(e.target.value, 10) || 2 }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Financial Rent & Deposits */}
                            <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                                    💰 财务承诺与押金
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">月租金 (RM)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={editingAgreement?.monthly_rent ?? 0}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, monthly_rent: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">履约押金 (RM)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={editingAgreement?.security_deposit ?? 0}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, security_deposit: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">水电押金 (RM)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={editingAgreement?.utility_deposit ?? 0}
                                            onChange={e => setEditingAgreement(prev => ({ ...prev, utility_deposit: parseFloat(e.target.value) || 0 }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tags & Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        自定义标签 (以逗号分隔)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="例如：太平, 核心仓库, 外劳宿舍"
                                        value={(editingAgreement?.tags || []).join(', ')}
                                        onChange={e => {
                                            const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            setEditingAgreement(prev => ({ ...prev, tags: arr }));
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                        履约状态
                                    </label>
                                    <select
                                        value={editingAgreement?.status || 'Active'}
                                        onChange={e => setEditingAgreement(prev => ({ ...prev, status: e.target.value as TenancyStatus }))}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        <option value="Active">履约中 (Active)</option>
                                        <option value="Expiring_Soon">即将到期 (Expiring Soon)</option>
                                        <option value="Expired">已到期 (Expired)</option>
                                        <option value="Renewed">已续约 (Renewed)</option>
                                        <option value="Terminated">已终止/已退租 (Terminated)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Attachment File URL */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                    合同附件链接 / Storage URL
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    value={editingAgreement?.file_url || ''}
                                    onChange={e => setEditingAgreement(prev => ({ ...prev, file_url: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500/50"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                                    关键条款备注 (Notes)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="记录续约优先权、付款方式、中介佣金、退租修缮条款等..."
                                    value={editingAgreement?.notes || ''}
                                    onChange={e => setEditingAgreement(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                />
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingAgreement(null);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/20 transition-all"
                                >
                                    保存租约档案
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Document Preview Modal ─────────────────────────────────── */}
            {isPreviewModalOpen && previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#12131c] border border-white/10 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-purple-400" />
                                <span className="font-bold text-white text-sm truncate max-w-md">{previewDoc.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewDoc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Download size={13} /> 下载原件
                                </a>
                                <button
                                    onClick={() => {
                                        setIsPreviewModalOpen(false);
                                        setPreviewDoc(null);
                                    }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black/50 p-2 overflow-auto flex items-center justify-center">
                            {previewDoc.type === 'pdf' ? (
                                <iframe
                                    src={previewDoc.url}
                                    title={previewDoc.title}
                                    className="w-full h-full rounded-xl border-0"
                                />
                            ) : (
                                <img
                                    src={previewDoc.url}
                                    alt={previewDoc.title}
                                    className="max-w-full max-h-full object-contain rounded-xl"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── WhatsApp Reminder Modal ────────────────────────────────── */}
            {isWaModalOpen && selectedWaAgreement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#12131c] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">下发 WhatsApp 续约提醒</h3>
                                    <p className="text-xs text-gray-400">向房东或相关负责人下发租约到期预警与催办模板消息</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsWaModalOpen(false);
                                    setSelectedWaAgreement(null);
                                }}
                                className="p-1 rounded-lg text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">标的:</span>
                                <span className="font-bold text-white">{selectedWaAgreement.title}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">到期日:</span>
                                <span className="font-mono text-amber-300 font-bold">
                                    {selectedWaAgreement.end_date || '未定'} 
                                    {selectedWaAgreement.days_remaining !== undefined && ` (${selectedWaAgreement.days_remaining} 天后)`}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">月租金:</span>
                                <span className="font-mono text-emerald-400 font-bold">
                                    RM {Number(selectedWaAgreement.monthly_rent || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-300 block mb-1">接收人手机号码 (WhatsApp)</label>
                            <input
                                type="text"
                                placeholder="例如: 0123456789 或 60123456789"
                                value={waCustomPhone}
                                onChange={e => setWaCustomPhone(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-300 block mb-1">特别附言备注 (可选)</label>
                            <textarea
                                rows={2}
                                placeholder="例如：拟定下周一下午安排登门协商续约事宜..."
                                value={waCustomNote}
                                onChange={e => setWaCustomNote(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setIsWaModalOpen(false);
                                    setSelectedWaAgreement(null);
                                }}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSendWhatsAppReminder}
                                disabled={isSendingWa}
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {isSendingWa ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>正在发送...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} />
                                        <span>立即发送提醒</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenancyAgreementFolder;
