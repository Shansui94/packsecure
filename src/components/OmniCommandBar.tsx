import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Search,
    Sparkles,
    Command,
    X,
    CornerDownLeft,
    AlertTriangle,
    CheckCircle2,
    Layers,
    Cpu,
    FileText,
    Users,
    Package,
    ArrowUpRight,
    Loader2,
    SlidersHorizontal,
    Bot
} from 'lucide-react';
import {
    searchEntities,
    parseLocalActionIntent,
    queryOmniAI,
    executeOmniAction,
    OmniSearchResult,
    OmniActionDraft,
    OmniInsightData,
    OmniResultType
} from '../services/omniSearchService';
import { User } from '../types';
import { t } from '../utils/i18n';

interface OmniCommandBarProps {
    currentUser: User | null;
    allowedPageIds?: Set<string> | null;
    onNavigate: (pageId: string) => void;
}

type FilterCategory = 'all' | 'pages' | 'orders' | 'machines' | 'customers' | 'items' | 'users' | 'actions';

const CATEGORY_TABS: { key: FilterCategory; labelKey: string; prefix?: string; icon: any }[] = [
    { key: 'all', labelKey: '全部', icon: SlidersHorizontal },
    { key: 'pages', labelKey: '页面', prefix: '>', icon: Layers },
    { key: 'orders', labelKey: '送货单', prefix: 'do:', icon: FileText },
    { key: 'machines', labelKey: '机台', prefix: '#', icon: Cpu },
    { key: 'customers', labelKey: '客户', prefix: 'cust:', icon: Users },
    { key: 'items', labelKey: '物料SKU', prefix: 'sku:', icon: Package },
    { key: 'users', labelKey: '员工/司机', prefix: '@', icon: Users },
    { key: 'actions', labelKey: '业务指令', icon: Sparkles }
];

export const OmniCommandBar: React.FC<OmniCommandBarProps> = ({
    currentUser,
    allowedPageIds,
    onNavigate
}) => {
    const [, setLangTick] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<FilterCategory>('all');
    const [isSearching, setIsSearching] = useState(false);
    const [isInterpretingAI, setIsInterpretingAI] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

    // Search results state
    const [results, setResults] = useState<{
        pages: OmniSearchResult[];
        orders: OmniSearchResult[];
        customers: OmniSearchResult[];
        machines: OmniSearchResult[];
        items: OmniSearchResult[];
        users: OmniSearchResult[];
    }>({
        pages: [],
        orders: [],
        customers: [],
        machines: [],
        items: [],
        users: []
    });

    // Active Card Modes (Mode B: Action Preview, Mode C: Insight)
    const [activeActionDraft, setActiveActionDraft] = useState<OmniActionDraft | null>(null);
    const [activeInsight, setActiveInsight] = useState<OmniInsightData | null>(null);
    const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    // Keyboard navigation index across flat list
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<any>(null);

    // Flatten results according to active tab
    const flatResults = useMemo(() => {
        const list: OmniSearchResult[] = [];
        if (activeTab === 'all' || activeTab === 'pages') list.push(...results.pages);
        if (activeTab === 'all' || activeTab === 'orders') list.push(...results.orders);
        if (activeTab === 'all' || activeTab === 'machines') list.push(...results.machines);
        if (activeTab === 'all' || activeTab === 'customers') list.push(...results.customers);
        if (activeTab === 'all' || activeTab === 'items') list.push(...results.items);
        if (activeTab === 'all' || activeTab === 'users') list.push(...results.users);
        return list;
    }, [results, activeTab]);

    // Local action suggestion detected from query
    const suggestedAction = useMemo(() => {
        if (!query.trim() || activeActionDraft || activeInsight) return null;
        return parseLocalActionIntent(query, currentUser);
    }, [query, currentUser, activeActionDraft, activeInsight]);

    // Global shortcut listener (Cmd/Ctrl + K and /)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K or Ctrl+K
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                return;
            }

            // Pressing '/' to search if not currently inside an input
            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
            if (e.key === '/' && !isEditing && !isOpen) {
                e.preventDefault();
                setIsOpen(true);
                return;
            }

            // Escape key handling
            if (e.key === 'Escape' && isOpen) {
                if (activeActionDraft || activeInsight) {
                    setActiveActionDraft(null);
                    setActiveInsight(null);
                } else {
                    setIsOpen(false);
                }
            }
        };

        const handleCustomOpen = (e: any) => {
            setIsOpen(true);
            if (e.detail?.initialQuery) {
                setQuery(e.detail.initialQuery);
            }
        };

        const handleLangChange = () => setLangTick((prev) => prev + 1);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('packsecure:open-omni-command', handleCustomOpen);
        window.addEventListener('packsecure:lang-change', handleLangChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('packsecure:open-omni-command', handleCustomOpen);
            window.removeEventListener('packsecure:lang-change', handleLangChange);
        };
    }, [isOpen, activeActionDraft, activeInsight]);

    // Auto focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
            // Run initial empty search to populate default pages
            executeSearch('');
        } else {
            // Reset states on close
            setQuery('');
            setActiveTab('all');
            setActiveActionDraft(null);
            setActiveInsight(null);
            setFeedbackToast(null);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Perform debounced entity search
    const executeSearch = useCallback(
        async (searchQuery: string) => {
            setIsSearching(true);
            try {
                const res = await searchEntities(searchQuery, {
                    allowedPageIds,
                    role: currentUser?.role,
                    limitPerCategory: 5
                });
                setResults(res);
                setSelectedIndex(0);
            } catch (err) {
                console.error('OmniSearch failed:', err);
            } finally {
                setIsSearching(false);
            }
        },
        [allowedPageIds, currentUser]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setActiveActionDraft(null);
        setActiveInsight(null);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            executeSearch(val);
        }, 120);
    };

    // Tab switch handler
    const handleSelectTab = (tab: FilterCategory) => {
        setActiveTab(tab);
        const tabInfo = CATEGORY_TABS.find((t) => t.key === tab);
        if (tabInfo?.prefix && !query.startsWith(tabInfo.prefix)) {
            setQuery(`${tabInfo.prefix} `);
            executeSearch(`${tabInfo.prefix} `);
        } else if (tab === 'all') {
            const cleaned = query.replace(/^([>#@]|do:|cust:|sku:|page:|machine:|staff:)\s*/i, '');
            setQuery(cleaned);
            executeSearch(cleaned);
        }
        inputRef.current?.focus();
    };

    // Item selection handler
    const handleSelectResult = (result: OmniSearchResult) => {
        if (result.targetPage) {
            onNavigate(result.targetPage);
            setIsOpen(false);
        }
    };

    // Trigger AI interpretation for free-form queries
    const handleAskAI = async () => {
        if (!query.trim()) return;
        setIsInterpretingAI(true);
        setFeedbackToast(null);

        try {
            const aiRes = await queryOmniAI(query, {
                role: currentUser?.role,
                user: currentUser
            });

            if (aiRes.type === 'action' && aiRes.actionDraft) {
                setActiveActionDraft(aiRes.actionDraft);
                setActiveInsight(null);
            } else if (aiRes.type === 'insight' && aiRes.insightData) {
                setActiveInsight(aiRes.insightData);
                setActiveActionDraft(null);
            } else {
                setFeedbackToast({
                    type: 'info',
                    text: aiRes.message || '未能精确识别该意图，建议尝试更具体的业务关键词或格式。'
                });
            }
        } catch (err: any) {
            setFeedbackToast({
                type: 'error',
                text: `智能识别失败: ${err.message || '网络连接异常'}`
            });
        } finally {
            setIsInterpretingAI(false);
        }
    };

    // Execute active action draft
    const handleConfirmAction = async () => {
        if (!activeActionDraft) return;
        setIsExecuting(true);

        try {
            const res = await executeOmniAction(activeActionDraft, currentUser);
            if (res.success) {
                setFeedbackToast({ type: 'success', text: res.message });
                setTimeout(() => {
                    setIsOpen(false);
                    if (activeActionDraft.targetPage) {
                        onNavigate(activeActionDraft.targetPage);
                    }
                }, 1200);
            } else {
                setFeedbackToast({ type: 'error', text: res.message });
            }
        } catch (err: any) {
            setFeedbackToast({ type: 'error', text: `执行异常: ${err.message}` });
        } finally {
            setIsExecuting(false);
        }
    };

    // Keyboard navigation (Arrow keys, Enter)
    const handleKeyDownInBox = (e: React.KeyboardEvent) => {
        // If in Action Draft mode: Enter triggers confirm execution
        if (activeActionDraft) {
            if (e.key === 'Enter' && !isExecuting) {
                e.preventDefault();
                handleConfirmAction();
            }
            return;
        }

        // If in Insight mode: Enter navigates to target report page
        if (activeInsight) {
            if (e.key === 'Enter' && activeInsight.targetPage) {
                e.preventDefault();
                onNavigate(activeInsight.targetPage);
                setIsOpen(false);
            }
            return;
        }

        // Normal list navigation
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const max = flatResults.length + (suggestedAction ? 1 : 0);
            if (max > 0) {
                setSelectedIndex((prev) => (prev + 1) % max);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const max = flatResults.length + (suggestedAction ? 1 : 0);
            if (max > 0) {
                setSelectedIndex((prev) => (prev - 1 + max) % max);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestedAction && selectedIndex === 0) {
                setActiveActionDraft(suggestedAction);
                return;
            }

            const adjustedIdx = suggestedAction ? selectedIndex - 1 : selectedIndex;
            if (flatResults[adjustedIdx]) {
                handleSelectResult(flatResults[adjustedIdx]);
            } else if (query.trim()) {
                // No item selected, fallback to AI interpretation
                handleAskAI();
            }
        }
    };

    // Helper for rendering category icons
    const getResultIcon = (type: OmniResultType) => {
        switch (type) {
            case 'page':
                return <Layers className="w-4 h-4 text-indigo-400" />;
            case 'order':
                return <FileText className="w-4 h-4 text-amber-400" />;
            case 'machine':
                return <Cpu className="w-4 h-4 text-emerald-400" />;
            case 'customer':
                return <Users className="w-4 h-4 text-purple-400" />;
            case 'item':
                return <Package className="w-4 h-4 text-cyan-400" />;
            case 'user':
                return <Users className="w-4 h-4 text-blue-400" />;
            default:
                return <ArrowUpRight className="w-4 h-4 text-zinc-400" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4 animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
        >
            <div className="w-full max-w-2xl bg-zinc-950/95 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[82vh] transition-all">
                {/* 1. Header Input Area */}
                <div className="p-3.5 border-b border-zinc-800/80 flex items-center gap-3 bg-zinc-900/50">
                    <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300">
                        {isSearching || isInterpretingAI ? (
                            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        ) : (
                            <Search className="w-5 h-5 text-zinc-400" />
                        )}
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDownInBox}
                        placeholder={t('输入关键词搜索，或指令如「报修 T1-M03」、「Ali请假」... (⌘K)')}
                        className="flex-1 bg-transparent text-white text-base sm:text-lg placeholder-zinc-500 font-medium focus:outline-none"
                    />

                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                executeSearch('');
                                setActiveActionDraft(null);
                                setActiveInsight(null);
                                inputRef.current?.focus();
                            }}
                            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-mono text-zinc-400">
                        <span>ESC</span>
                    </div>
                </div>

                {/* 2. Category Filter Tabs */}
                <div className="px-3.5 py-2 border-b border-zinc-800/60 bg-zinc-900/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {CATEGORY_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleSelectTab(tab.key)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{t(tab.labelKey)}</span>
                                {tab.prefix && (
                                    <span className="text-[10px] font-mono opacity-60 bg-black/20 px-1 rounded">
                                        {tab.prefix}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 3. Feedback Toast Alert */}
                {feedbackToast && (
                    <div
                        className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b ${
                            feedbackToast.type === 'success'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                                : feedbackToast.type === 'error'
                                ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                                : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                        }`}
                    >
                        <span>{feedbackToast.text}</span>
                        <button onClick={() => setFeedbackToast(null)} className="opacity-70 hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* 4. Main Body Area */}
                <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 custom-scrollbar">
                    {/* ── MODE B: ACTION PREVIEW CARD ── */}
                    {activeActionDraft ? (
                        <div className="p-4 rounded-xl bg-zinc-900 border border-indigo-500/40 space-y-3.5 shadow-xl animate-in fade-in duration-200">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            待执行业务草稿
                                        </span>
                                        <h3 className="text-base font-bold text-white">{activeActionDraft.title}</h3>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-1">{activeActionDraft.summary}</p>
                                </div>
                                <button
                                    onClick={() => setActiveActionDraft(null)}
                                    className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {activeActionDraft.isDangerous && (
                                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/60 flex items-center gap-2 text-xs text-rose-300 font-semibold">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                                    <span>{activeActionDraft.dangerReason || '高危操作警告：执行后将对生产或台账产生直接影响'}</span>
                                </div>
                            )}

                            {/* Editable Form Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {activeActionDraft.fields.map((f) => (
                                    <div key={f.key} className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                                            {f.label} {f.required && <span className="text-rose-400">*</span>}
                                        </label>
                                        {f.type === 'select' && f.options ? (
                                            <select
                                                value={f.value}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setActiveActionDraft({
                                                        ...activeActionDraft,
                                                        payload: { ...activeActionDraft.payload, [f.key]: val },
                                                        fields: activeActionDraft.fields.map((item) =>
                                                            item.key === f.key ? { ...item, value: val } : item
                                                        )
                                                    });
                                                }}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                            >
                                                {f.options.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : f.type === 'textarea' ? (
                                            <textarea
                                                value={f.value}
                                                rows={2}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setActiveActionDraft({
                                                        ...activeActionDraft,
                                                        payload: { ...activeActionDraft.payload, [f.key]: val },
                                                        fields: activeActionDraft.fields.map((item) =>
                                                            item.key === f.key ? { ...item, value: val } : item
                                                        )
                                                    });
                                                }}
                                                className="w-full bg-transparent text-xs text-white focus:outline-none resize-none"
                                            />
                                        ) : (
                                            <input
                                                type={f.type}
                                                value={f.value}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setActiveActionDraft({
                                                        ...activeActionDraft,
                                                        payload: { ...activeActionDraft.payload, [f.key]: val },
                                                        fields: activeActionDraft.fields.map((item) =>
                                                            item.key === f.key ? { ...item, value: val } : item
                                                        )
                                                    });
                                                }}
                                                className="w-full bg-transparent text-xs text-white focus:outline-none"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Execution Button Bar */}
                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                                <button
                                    onClick={() => setActiveActionDraft(null)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                >
                                    取消 (Esc)
                                </button>
                                <button
                                    onClick={handleConfirmAction}
                                    disabled={isExecuting}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                                        activeActionDraft.isDangerous
                                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30'
                                    } disabled:opacity-50`}
                                >
                                    {isExecuting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>正在落库...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CornerDownLeft className="w-3.5 h-3.5" />
                                            <span>一键确认执行 (Enter ↵)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : activeInsight ? (
                        /* ── MODE C: BUSINESS INSIGHT CARD ── */
                        <div className="p-4 rounded-xl bg-zinc-900 border border-emerald-500/40 space-y-3.5 shadow-xl animate-in fade-in duration-200">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                            <Bot className="w-3 h-3" />
                                            经营统计洞察
                                        </span>
                                        <h3 className="text-base font-bold text-white">{activeInsight.title}</h3>
                                    </div>
                                    <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{activeInsight.summary}</p>
                                </div>
                                <button
                                    onClick={() => setActiveInsight(null)}
                                    className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Key Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                                {activeInsight.keyMetrics.map((m, idx) => (
                                    <div key={idx} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[10px] font-bold uppercase text-zinc-400">{m.label}</span>
                                        <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
                                            {m.value}
                                        </div>
                                        {m.subtext && <div className="text-[10px] text-zinc-500">{m.subtext}</div>}
                                    </div>
                                ))}
                            </div>

                            {/* Deep Navigation Button */}
                            {activeInsight.targetPage && (
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                                    <button
                                        onClick={() => {
                                            if (activeInsight.targetPage) {
                                                onNavigate(activeInsight.targetPage);
                                                setIsOpen(false);
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
                                    >
                                        <span>{activeInsight.targetPageLabel || '前往详情看板'}</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── MODE A: INSTANT SEARCH RESULTS ── */
                        <div className="space-y-1">
                            {/* Suggested Action Bar (if local heuristic recognized intent) */}
                            {suggestedAction && (
                                <div
                                    onClick={() => setActiveActionDraft(suggestedAction)}
                                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                        selectedIndex === 0
                                            ? 'bg-indigo-900/40 border-indigo-500 text-white'
                                            : 'bg-zinc-900/60 border-indigo-500/30 text-zinc-200 hover:bg-zinc-900'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow">
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-indigo-300">
                                                    识别到业务指令：
                                                </span>
                                                <span className="text-sm font-bold text-white">
                                                    {suggestedAction.title}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400 mt-0.5">{suggestedAction.summary}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold">
                                        <span>按 Enter 解析</span>
                                        <CornerDownLeft className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            )}

                            {/* Normal Matching Results */}
                            {flatResults.length > 0 ? (
                                flatResults.map((item, idx) => {
                                    const actualIndex = suggestedAction ? idx + 1 : idx;
                                    const isHighlighted = selectedIndex === actualIndex;

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectResult(item)}
                                            onMouseEnter={() => setSelectedIndex(actualIndex)}
                                            className={`p-2.5 sm:p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                                                isHighlighted
                                                    ? 'bg-zinc-800/90 border-zinc-600 text-white shadow-md'
                                                    : 'bg-transparent border-transparent text-zinc-300 hover:bg-zinc-900/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0">
                                                    {getResultIcon(item.type)}
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white truncate">
                                                            {item.title}
                                                        </span>
                                                        {item.badge && (
                                                            <span
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                                    item.badgeColor || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                                }`}
                                                            >
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.subtitle && (
                                                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                                                            {item.subtitle}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-zinc-500 flex items-center gap-1 text-xs">
                                                <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : query.trim() ? (
                                <div className="py-8 text-center space-y-3">
                                    <p className="text-sm text-zinc-400">
                                        未检索到直接匹配项，您可以尝试向 AI 提问或分发指令：
                                    </p>
                                    <button
                                        onClick={handleAskAI}
                                        disabled={isInterpretingAI}
                                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold hover:brightness-110 shadow-lg flex items-center gap-2 mx-auto disabled:opacity-50"
                                    >
                                        {isInterpretingAI ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>AI 正在思考分析...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                <span>由 AI 深度解析并生成卡片 (Enter ↵)</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="py-6 px-4 text-center text-xs text-zinc-500 space-y-1">
                                    <p>支持快速搜索单据、机台、客户、物料与员工</p>
                                    <p className="font-mono text-[11px] text-zinc-600">
                                        小技巧：可直接输入「报修 T1-M03」、「明天Ali请假」、「稼动率汇总」
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 5. Footer Shortcut Hints */}
                <div className="p-2.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">↑↓</kbd>
                            <span>移动</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">↵</kbd>
                            <span>确认</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono">ESC</kbd>
                            <span>退出</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-400">
                        <Command className="w-3 h-3 text-indigo-400" />
                        <span className="font-semibold text-zinc-400">Packsecure Omni v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OmniCommandBar;
