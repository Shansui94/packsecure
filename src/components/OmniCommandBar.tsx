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
    Bot,
    MessageSquare,
    Paperclip,
    UploadCloud,
    Truck,
    ExternalLink,
    Check
} from 'lucide-react';
import {
    searchEntities,
    parseLocalActionIntent,
    checkLocalGreetingOrHelp,
    queryOmniAI,
    executeOmniAction,
    processDocumentFile,
    commitDocumentDraft,
    OmniSearchResult,
    OmniActionDraft,
    OmniInsightData,
    OmniDocumentDraft,
    OmniAnswerData,
    OmniResultType
} from '../services/omniSearchService';
import { User } from '../types';
import { t } from '../utils/i18n';

interface OmniCommandBarProps {
    currentUser: User | null;
    allowedPageIds?: Set<string> | null;
    onNavigate: (pageId: string) => void;
}

type FilterCategory = 'all' | 'pages' | 'orders' | 'machines' | 'customers' | 'items' | 'users' | 'docs' | 'actions';

const CATEGORY_TABS: { key: FilterCategory; labelKey: string; prefix?: string; icon: any }[] = [
    { key: 'all', labelKey: '全部', icon: SlidersHorizontal },
    { key: 'pages', labelKey: '页面', prefix: '>', icon: Layers },
    { key: 'orders', labelKey: '送货单', prefix: 'do:', icon: FileText },
    { key: 'machines', labelKey: '机台', prefix: '#', icon: Cpu },
    { key: 'customers', labelKey: '客户', prefix: 'cust:', icon: Users },
    { key: 'items', labelKey: '物料SKU', prefix: 'sku:', icon: Package },
    { key: 'users', labelKey: '员工/司机', prefix: '@', icon: Users },
    { key: 'docs', labelKey: '凭证文档', prefix: 'doc:', icon: FileText },
    { key: 'actions', labelKey: '业务指令', icon: Sparkles }
];

const DOCUMENT_CATEGORIES = [
    { key: 'PUSPAKOM_INSURANCE', label: '🚛 PUSPAKOM 验车报告 / 车险', icon: '🚛' },
    { key: 'GOVERNMENT_LETTER', label: '📩 政府公函 / 市议会/消拯局通告', icon: '📩' },
    { key: 'PETROL_FLEET', label: '⛽ 司机燃油票据 (Petrol Claim)', icon: '⛽' },
    { key: 'LORRY_SERVICE', label: '🔧 货车维保发票 (Lorry Service)', icon: '🔧' },
    { key: 'SSM_REGISTRATION', label: '🏢 SSM 公司注册登记资质', icon: '🏢' },
    { key: 'SOCSO_EPF', label: '🏛️ SOCSO / EPF 社保公积金单', icon: '🏛️' },
    { key: 'LICENSE', label: '🪪 驾驶证 (GDL) / 特种作业执照', icon: '🪪' },
    { key: 'UNASSIGNED', label: '📁 综合日常发票 / 其它单据', icon: '📁' }
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

    // Multi-modal upload state
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessingDoc, setIsProcessingDoc] = useState(false);
    const [activeDocumentDraft, setActiveDocumentDraft] = useState<OmniDocumentDraft | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search results state
    const [results, setResults] = useState<{
        pages: OmniSearchResult[];
        orders: OmniSearchResult[];
        customers: OmniSearchResult[];
        machines: OmniSearchResult[];
        items: OmniSearchResult[];
        users: OmniSearchResult[];
        docs: OmniSearchResult[];
    }>({
        pages: [],
        orders: [],
        customers: [],
        machines: [],
        items: [],
        users: [],
        docs: []
    });

    // Active Card Modes (Mode B: Action Preview, Mode C: Insight, Mode D: Document, Mode E: Answer)
    const [activeActionDraft, setActiveActionDraft] = useState<OmniActionDraft | null>(null);
    const [activeInsight, setActiveInsight] = useState<OmniInsightData | null>(null);
    const [activeAnswer, setActiveAnswer] = useState<OmniAnswerData | null>(null);
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
        if (activeTab === 'all' || activeTab === 'docs') list.push(...results.docs);
        return list;
    }, [results, activeTab]);

    // Local action suggestion detected from query
    const suggestedAction = useMemo(() => {
        if (!query.trim() || activeActionDraft || activeInsight || activeDocumentDraft || activeAnswer) return null;
        return parseLocalActionIntent(query, currentUser);
    }, [query, currentUser, activeActionDraft, activeInsight, activeDocumentDraft, activeAnswer]);

    // Instant local greeting & operational guidance detected from query (e.g. "你好", "hello", "帮助")
    const localGreeting = useMemo(() => {
        if (!query.trim() || activeActionDraft || activeInsight || activeDocumentDraft || activeAnswer) return null;
        return checkLocalGreetingOrHelp(query, currentUser);
    }, [query, currentUser, activeActionDraft, activeInsight, activeDocumentDraft, activeAnswer]);

    // Global shortcut listener (Cmd/Ctrl + K and /)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
                return;
            }

            const activeTag = (document.activeElement?.tagName || '').toLowerCase();
            const isEditing = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;
            if (e.key === '/' && !isEditing && !isOpen) {
                e.preventDefault();
                setIsOpen(true);
                return;
            }

            if (e.key === 'Escape' && isOpen) {
                if (activeActionDraft || activeInsight || activeDocumentDraft || activeAnswer) {
                    setActiveActionDraft(null);
                    setActiveInsight(null);
                    setActiveDocumentDraft(null);
                    setActiveAnswer(null);
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
    }, [isOpen, activeActionDraft, activeInsight, activeDocumentDraft]);

    // Clipboard Paste Listener (Ctrl+V for images/PDFs)
    useEffect(() => {
        if (!isOpen) return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.includes('image') || item.type.includes('pdf')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        handleProcessFile(file);
                        return;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen, currentUser]);

    // Auto focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
            executeSearch('');
        } else {
            setQuery('');
            setActiveTab('all');
            setActiveActionDraft(null);
            setActiveInsight(null);
            setActiveDocumentDraft(null);
            setActiveAnswer(null);
            setFeedbackToast(null);
            setSelectedIndex(0);
            setIsDragOver(false);
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
        setActiveDocumentDraft(null);
        setActiveAnswer(null);

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
            const cleaned = query.replace(/^([>#@]|do:|cust:|sku:|doc:|file:|page:|machine:|staff:)\s*/i, '');
            setQuery(cleaned);
            executeSearch(cleaned);
        }
        inputRef.current?.focus();
    };

    // Item selection handler
    const handleSelectResult = (result: OmniSearchResult) => {
        if (result.type === 'doc' && result.metadata?.file_url) {
            window.open(result.metadata.file_url, '_blank');
            setIsOpen(false);
            return;
        }

        if (result.targetPage) {
            onNavigate(result.targetPage);
            setIsOpen(false);
        }
    };

    // Apply quick action template from AI guidance
    const handleApplyQuickAction = (actionQuery: string) => {
        setQuery(actionQuery);
        setActiveAnswer(null);
        setActiveActionDraft(null);
        setActiveInsight(null);
        setActiveDocumentDraft(null);
        executeSearch(actionQuery);
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // File Processing (Intake -> Gemini Multimodal OCR -> Structured Draft)
    const handleProcessFile = async (file: File) => {
        if (!file) return;
        setIsProcessingDoc(true);
        setFeedbackToast(null);
        setActiveActionDraft(null);
        setActiveInsight(null);
        setActiveAnswer(null);

        try {
            const draft = await processDocumentFile(file, currentUser);
            setActiveDocumentDraft(draft);
            setFeedbackToast({
                type: 'info',
                text: `✨ AI 识别成功: 已提取【${draft.categoryLabel}】相关元数据，请核对并确认`
            });
        } catch (err: any) {
            console.error('File intake failed:', err);
            setFeedbackToast({
                type: 'error',
                text: `文件识别失败: ${err.message || '网络连接或模型响应异常'}`
            });
        } finally {
            setIsProcessingDoc(false);
        }
    };

    // Drag & Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleProcessFile(file);
        }
    };

    // Confirm Document Draft and Commit Side-Effects
    const handleConfirmDocument = async () => {
        if (!activeDocumentDraft) return;
        setIsExecuting(true);

        try {
            const res = await commitDocumentDraft(activeDocumentDraft, currentUser);
            if (res.success) {
                setFeedbackToast({ type: 'success', text: res.message });
                setTimeout(() => {
                    setActiveDocumentDraft(null);
                    setIsOpen(false);
                }, 1500);
            } else {
                setFeedbackToast({ type: 'error', text: res.message });
            }
        } catch (err: any) {
            setFeedbackToast({ type: 'error', text: `归档异常: ${err.message}` });
        } finally {
            setIsExecuting(false);
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
                setActiveDocumentDraft(null);
                setActiveAnswer(null);
            } else if (aiRes.type === 'insight' && aiRes.insightData) {
                setActiveInsight(aiRes.insightData);
                setActiveActionDraft(null);
                setActiveDocumentDraft(null);
                setActiveAnswer(null);
            } else if (aiRes.type === 'answer' && aiRes.answerData) {
                setActiveAnswer(aiRes.answerData);
                setActiveActionDraft(null);
                setActiveInsight(null);
                setActiveDocumentDraft(null);
            } else {
                setFeedbackToast({
                    type: 'info',
                    text: aiRes.message || '未能精确识别该意图，建议尝试更具体的业务关键词或指令。'
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
        if (activeDocumentDraft) {
            if (e.key === 'Enter' && !isExecuting) {
                e.preventDefault();
                handleConfirmDocument();
            }
            return;
        }

        if (activeActionDraft) {
            if (e.key === 'Enter' && !isExecuting) {
                e.preventDefault();
                handleConfirmAction();
            }
            return;
        }

        if (activeInsight) {
            if (e.key === 'Enter' && activeInsight.targetPage) {
                e.preventDefault();
                onNavigate(activeInsight.targetPage);
                setIsOpen(false);
            }
            return;
        }

        if (activeAnswer || localGreeting) {
            const currentAns = activeAnswer || localGreeting;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (currentAns?.targetPage) {
                    onNavigate(currentAns.targetPage);
                    setIsOpen(false);
                } else if (currentAns?.quickActions && currentAns.quickActions.length > 0) {
                    handleApplyQuickAction(currentAns.quickActions[0].query);
                }
            }
            return;
        }

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
                handleAskAI();
            }
        }
    };

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
            case 'doc':
                return <FileText className="w-4 h-4 text-rose-400" />;
            default:
                return <ArrowUpRight className="w-4 h-4 text-zinc-400" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="w-full max-w-2xl bg-zinc-950/95 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[85vh] transition-all relative">
                {/* Drag and drop full-window overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-50 bg-indigo-950/90 border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95">
                        <UploadCloud className="w-16 h-16 text-indigo-400 animate-bounce mb-3" />
                        <h3 className="text-xl font-black text-white">松开文件立即智能归档</h3>
                        <p className="text-sm text-indigo-200 mt-1">
                            支持 SSM、政府公函、Claim 报销票据、PUSPAKOM 验车报告、SOCSO 缴费单及驾照
                        </p>
                    </div>
                )}

                {/* 1. Header Input Area */}
                <div className="p-3.5 border-b border-zinc-800/80 flex items-center gap-2.5 bg-zinc-900/50">
                    <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-300 shrink-0">
                        {isSearching || isInterpretingAI || isProcessingDoc ? (
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
                        placeholder={t('搜索单据/客户/机台，或粘贴发票截图 (Ctrl+V) / 拖入文件 (⌘K)')}
                        className="flex-1 bg-transparent text-white text-base sm:text-lg placeholder-zinc-500 font-medium focus:outline-none min-w-0"
                    />

                    {/* Hidden file input for attachment button */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleProcessFile(e.target.files[0]);
                            }
                        }}
                        className="hidden"
                    />

                    {/* Attachment Upload Button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingDoc}
                        title={t('上传文件或发票单据 (支持 PDF/图片)')}
                        className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800/80 rounded-xl transition cursor-pointer shrink-0"
                    >
                        <Paperclip className="w-4 h-4" />
                    </button>

                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                executeSearch('');
                                setActiveActionDraft(null);
                                setActiveInsight(null);
                                setActiveDocumentDraft(null);
                                inputRef.current?.focus();
                            }}
                            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}

                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-mono text-zinc-400 shrink-0">
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
                    {/* ── MODE D: DOCUMENT INTAKE & SMART ROUTE PREVIEW CARD ── */}
                    {activeDocumentDraft ? (
                        <div className="p-4 rounded-xl bg-zinc-900 border border-indigo-500/50 space-y-3.5 shadow-xl animate-in fade-in duration-200">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    {activeDocumentDraft.previewUrl.startsWith('data:image') ? (
                                        <img
                                            src={activeDocumentDraft.previewUrl}
                                            alt="Preview"
                                            className="w-12 h-12 object-cover rounded-lg border border-zinc-700 bg-zinc-950 shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-300 shrink-0 font-bold text-xs">
                                            PDF
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3 text-amber-300" />
                                                智能凭证识别
                                            </span>
                                            <span className="text-xs font-bold text-white truncate max-w-[220px]">
                                                {activeDocumentDraft.fileName}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            AI 抽取置信度: {(activeDocumentDraft.confidenceScore * 100).toFixed(0)}% • 待用户复核确认
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setActiveDocumentDraft(null)}
                                    className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Entity Disambiguation and Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {/* Category Dropdown Picker */}
                                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 col-span-1 sm:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                                        识别分类 / 归档目标
                                    </label>
                                    <select
                                        value={activeDocumentDraft.categoryKey}
                                        onChange={(e) => {
                                            const catKey = e.target.value;
                                            const found = DOCUMENT_CATEGORIES.find((c) => c.key === catKey);
                                            setActiveDocumentDraft({
                                                ...activeDocumentDraft,
                                                categoryKey: catKey,
                                                categoryLabel: found?.label || catKey,
                                                sideEffects: {
                                                    updateLorryInspection: catKey === 'PUSPAKOM_INSURANCE',
                                                    createTask: catKey === 'GOVERNMENT_LETTER',
                                                    createClaim: catKey === 'PETROL_FLEET' || catKey === 'LORRY_SERVICE',
                                                    updateEmployeeLicense: catKey === 'LICENSE'
                                                }
                                            });
                                        }}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none font-semibold"
                                    >
                                        {DOCUMENT_CATEGORIES.map((cat) => (
                                            <option key={cat.key} value={cat.key}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Vehicle Plate (with matching indicator) */}
                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold uppercase text-zinc-400">
                                            关联车牌 (Vehicle Plate)
                                        </label>
                                        {activeDocumentDraft.isPlateMatched ? (
                                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                                <Check className="w-3 h-3" /> 已匹配
                                            </span>
                                        ) : activeDocumentDraft.vehiclePlate ? (
                                            <span className="text-[10px] font-bold text-amber-400">未收录车牌</span>
                                        ) : null}
                                    </div>
                                    <input
                                        type="text"
                                        value={activeDocumentDraft.vehiclePlate || ''}
                                        placeholder="例: AKB 8821"
                                        onChange={(e) =>
                                            setActiveDocumentDraft({
                                                ...activeDocumentDraft,
                                                vehiclePlate: e.target.value.toUpperCase()
                                            })
                                        }
                                        className="w-full bg-transparent text-xs text-white focus:outline-none font-mono font-bold"
                                    />
                                </div>

                                {/* Total Amount */}
                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                                        单据金额 (Total RM)
                                    </label>
                                    <input
                                        type="number"
                                        value={activeDocumentDraft.totalAmount || ''}
                                        placeholder="0.00"
                                        onChange={(e) =>
                                            setActiveDocumentDraft({
                                                ...activeDocumentDraft,
                                                totalAmount: parseFloat(e.target.value) || 0
                                            })
                                        }
                                        className="w-full bg-transparent text-xs text-emerald-400 focus:outline-none font-mono font-bold"
                                    />
                                </div>

                                {/* Vendor / Issuer */}
                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                                        机构/商户 (Vendor / Issuer)
                                    </label>
                                    <input
                                        type="text"
                                        value={activeDocumentDraft.vendorName || ''}
                                        placeholder="例: PUSPAKOM Sdn Bhd / Majlis / Petronas"
                                        onChange={(e) =>
                                            setActiveDocumentDraft({
                                                ...activeDocumentDraft,
                                                vendorName: e.target.value
                                            })
                                        }
                                        className="w-full bg-transparent text-xs text-white focus:outline-none"
                                    />
                                </div>

                                {/* Deadline / Due Date */}
                                <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                                        截止日 / 到期日 (Deadline)
                                    </label>
                                    <input
                                        type="date"
                                        value={activeDocumentDraft.dueDate || ''}
                                        onChange={(e) =>
                                            setActiveDocumentDraft({
                                                ...activeDocumentDraft,
                                                dueDate: e.target.value
                                            })
                                        }
                                        className="w-full bg-transparent text-xs text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Automated Side-Effects Checklist */}
                            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-2">
                                <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                                    确认入库后自动联动执行：
                                </span>
                                <div className="space-y-1.5 text-xs text-zinc-300">
                                    {activeDocumentDraft.categoryKey === 'PUSPAKOM_INSURANCE' && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={activeDocumentDraft.sideEffects.updateLorryInspection}
                                                onChange={(e) =>
                                                    setActiveDocumentDraft({
                                                        ...activeDocumentDraft,
                                                        sideEffects: {
                                                            ...activeDocumentDraft.sideEffects,
                                                            updateLorryInspection: e.target.checked
                                                        }
                                                    })
                                                }
                                                className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                                            />
                                            <span>
                                                更新车辆 [{activeDocumentDraft.vehiclePlate || '对应罗里'}] 验车维保记录与到期日
                                            </span>
                                        </label>
                                    )}

                                    {activeDocumentDraft.categoryKey === 'GOVERNMENT_LETTER' && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={activeDocumentDraft.sideEffects.createTask}
                                                onChange={(e) =>
                                                    setActiveDocumentDraft({
                                                        ...activeDocumentDraft,
                                                        sideEffects: {
                                                            ...activeDocumentDraft.sideEffects,
                                                            createTask: e.target.checked
                                                        }
                                                    })
                                                }
                                                className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                                            />
                                            <span>
                                                在协同待办中心创建公函整改跟进任务 (截止日: {activeDocumentDraft.dueDate || '无'})
                                            </span>
                                        </label>
                                    )}

                                    {(activeDocumentDraft.categoryKey === 'PETROL_FLEET' || activeDocumentDraft.categoryKey === 'LORRY_SERVICE') && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={activeDocumentDraft.sideEffects.createClaim}
                                                onChange={(e) =>
                                                    setActiveDocumentDraft({
                                                        ...activeDocumentDraft,
                                                        sideEffects: {
                                                            ...activeDocumentDraft.sideEffects,
                                                            createClaim: e.target.checked
                                                        }
                                                    })
                                                }
                                                className="rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-0"
                                            />
                                            <span>
                                                为当前员工生成费用报销草稿单据 (金额: RM {activeDocumentDraft.totalAmount || 0})
                                            </span>
                                        </label>
                                    )}

                                    <div className="text-[11px] text-zinc-500 pt-0.5">
                                        • 文件原件将永久归档至 William 经营中心文档库 ({activeDocumentDraft.periodYear}年)
                                    </div>
                                </div>
                            </div>

                            {/* Execution Button Bar */}
                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
                                <button
                                    onClick={() => setActiveDocumentDraft(null)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    取消 (Esc)
                                </button>
                                <button
                                    onClick={handleConfirmDocument}
                                    disabled={isExecuting}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white flex items-center gap-2 transition shadow-lg shadow-indigo-950/40 disabled:opacity-50 cursor-pointer"
                                >
                                    {isExecuting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>正在归档与写库...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CornerDownLeft className="w-3.5 h-3.5" />
                                            <span>一键确认归档与联动 (Enter ↵)</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : activeActionDraft ? (
                        /* ── MODE B: ACTION PREVIEW CARD ── */
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

                            {activeInsight.targetPage && (
                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                                    <button
                                        onClick={() => {
                                            if (activeInsight.targetPage) {
                                                onNavigate(activeInsight.targetPage);
                                                setIsOpen(false);
                                            }
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                                    >
                                        <span>{activeInsight.targetPageLabel || '前往详情看板'}</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (activeAnswer || localGreeting) ? (
                        /* ── MODE E: AI ANSWER / GREETING & GUIDANCE CARD ── */
                        (() => {
                            const displayAnswer = activeAnswer || localGreeting;
                            if (!displayAnswer) return null;
                            return (
                                <div className="p-4 rounded-xl bg-zinc-900 border border-indigo-500/40 space-y-4 shadow-xl animate-in fade-in duration-200">
                                    <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-950/50">
                                                <Bot className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3 text-amber-300" />
                                                        AI 智能协同中枢
                                                    </span>
                                                    <h3 className="text-sm sm:text-base font-bold text-white">
                                                        {displayAnswer.title}
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-zinc-400 mt-0.5">
                                                    实时为您解析意图、指引操作并推荐快捷动作
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setActiveAnswer(null);
                                                setQuery('');
                                            }}
                                            className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Formatted Answer Body */}
                                    <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-line space-y-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                                        {displayAnswer.text}
                                    </div>

                                    {/* Quick Action Chips (Click to auto-fill query and execute) */}
                                    {displayAnswer.quickActions && displayAnswer.quickActions.length > 0 && (
                                        <div className="space-y-2 pt-1">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                <span>推荐快捷指令（点击立即填入）</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-0.5">
                                                {displayAnswer.quickActions.map((qa, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleApplyQuickAction(qa.query)}
                                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800/90 hover:bg-indigo-600 hover:text-white text-zinc-300 border border-zinc-700/80 hover:border-indigo-500 transition shadow-sm flex items-center gap-1.5 cursor-pointer group"
                                                    >
                                                        <span>{qa.label}</span>
                                                        <CornerDownLeft className="w-3 h-3 text-zinc-500 group-hover:text-white transition" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Navigation / Trigger Voice AI */}
                                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                                        <button
                                            onClick={() => {
                                                setIsOpen(false);
                                                window.dispatchEvent(new CustomEvent('packsecure:open-ai-chat'));
                                            }}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>开启完整语音 AI 助手 (Titan)</span>
                                        </button>

                                        {displayAnswer.targetPage && (
                                            <button
                                                onClick={() => {
                                                    if (displayAnswer.targetPage) {
                                                        onNavigate(displayAnswer.targetPage);
                                                        setIsOpen(false);
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white flex items-center gap-1.5 transition shadow-lg shadow-indigo-950/40 cursor-pointer"
                                            >
                                                <span>{displayAnswer.targetPageLabel || '前往详情'}</span>
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()
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
                                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold hover:brightness-110 shadow-lg flex items-center gap-2 mx-auto disabled:opacity-50 cursor-pointer"
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
                                <div className="py-6 px-4 text-center text-xs text-zinc-500 space-y-1.5">
                                    <div className="flex items-center justify-center gap-3 text-zinc-400 mb-2">
                                        <span className="flex items-center gap-1">
                                            <Paperclip className="w-3.5 h-3.5 text-indigo-400" /> 拖入文件
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 font-mono text-[11px]">
                                            <kbd className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">Ctrl+V</kbd> 粘贴发票截图
                                        </span>
                                    </div>
                                    <p>支持快速搜索单据、机台、客户、物料、凭证与员工</p>
                                    <p className="font-mono text-[11px] text-zinc-600">
                                        小技巧：可输入「报修 T1-M03」、「明天Ali请假」、「Puspakom AKB」
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
                        <span className="font-semibold text-zinc-400">Packsecure Omni v2.0 (Multi-Modal)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OmniCommandBar;
