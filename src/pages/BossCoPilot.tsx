import React, { useState, useEffect, useRef } from 'react';
import {
    Bot,
    Send,
    Mic,
    MicOff,
    Sparkles,
    Download,
    Share2,
    Check,
    PhoneCall,
    ExternalLink,
    TrendingUp,
    AlertCircle,
    Calendar,
    BarChart3,
    Table,
    Layers,
    RefreshCw,
    FileSpreadsheet,
    MessageCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    fetchDailyBriefing,
    queryBossCoPilot,
    exportTableToCsv,
    copyWhatsAppText
} from '../services/universalQueryService';
import { UniversalQueryResponse, User } from '../types';

interface BossCoPilotProps {
    currentUser: User | null;
    onNavigate?: (page: string) => void;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    timestamp: string;
    text?: string;
    response?: UniversalQueryResponse;
}

const PRESET_CHIPS = [
    '🏭 今日各机台总产量与达成情况',
    '🚢 今日原材料采购卸柜 (Container) 记录',
    '🕒 今日车间加班 (OT) 时长与任务',
    '🚚 今日协助司机送货行程 (Trip) 进展',
    '🪵 今日到货搬运与打托 (Handling) 记录',
    '🛍️ 今日 Shopee 电商散单打包件数',
    '⭐ 今日加急特单 (Boss Order) 进度',
    '🚨 今日设备异常停机与次品报废统计'
];

export const BossCoPilot: React.FC<BossCoPilotProps> = ({ currentUser, onNavigate }) => {
    const { t } = useTranslation();
    const [briefing, setBriefing] = useState<UniversalQueryResponse | null>(null);
    const [isLoadingBriefing, setIsLoadingBriefing] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isQuerying, setIsQuerying] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // 页面加载自动获取今日高管智能快报
    useEffect(() => {
        loadBriefing();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isQuerying]);

    const loadBriefing = async () => {
        setIsLoadingBriefing(true);
        try {
            const data = await fetchDailyBriefing(currentUser?.role || 'SuperAdmin', currentUser?.name || 'Boss');
            setBriefing(data);
        } catch (err) {
            console.error('Failed to load briefing:', err);
        } finally {
            setIsLoadingBriefing(false);
        }
    };

    // 语音输入识别
    const toggleSpeechRecognition = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('当前浏览器不支持语音输入，请打字提问');
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'zh-CN';

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                setIsListening(false);
                // 语音输入完成后直接触发查询
                handleSend(transcript);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);

            recognitionRef.current = recognition;
            recognition.start();
        } catch {
            setIsListening(false);
        }
    };

    // 发送提问
    const handleSend = async (queryText?: string) => {
        const text = (queryText || inputText).trim();
        if (!text || isQuerying) return;

        const userMsg: ChatMessage = {
            id: `user_${Date.now()}`,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputText('');
        setIsQuerying(true);

        try {
            const res = await queryBossCoPilot(text, currentUser?.role || 'SuperAdmin', currentUser?.name || 'Boss');
            const aiMsg: ChatMessage = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                response: res
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: `ai_err_${Date.now()}`,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                response: {
                    summary: `查询失败: ${err.message || '系统繁忙，请稍后重试'}`,
                    whatsappText: ''
                }
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsQuerying(false);
        }
    };

    const handleCopyWhatsApp = async (text: string, id: string) => {
        const ok = await copyWhatsAppText(text);
        if (ok) {
            setCopiedIndex(id);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    // 执行快捷行动
    const handleActionClick = (action: { label: string; actionType: string; payload: string }) => {
        if (action.actionType === 'navigate' && onNavigate) {
            onNavigate(action.payload);
        } else if (action.actionType === 'call') {
            window.location.href = `tel:${action.payload}`;
        } else if (action.actionType === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodeURIComponent(action.payload)}`, '_blank');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
            {/* 顶栏信息 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-tr from-amber-600 to-orange-500 rounded-2xl text-white shadow-lg shadow-orange-500/20">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white flex items-center gap-2">
                            老板智问 (Boss Co-Pilot)
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                                全库穿透决策大脑
                            </span>
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            自然语言即席透视 · 生产/物流/机台/人事 · 0 SQL 门槛
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadBriefing}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition"
                        title="刷新今日高管快讯"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBriefing ? 'animate-spin' : ''}`} />
                        <span>刷新简报</span>
                    </button>
                </div>
            </div>

            {/* 今日高管智能快讯 (Daily Briefing Panel) */}
            {briefing && (
                <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border border-amber-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                            今日高管晨晚简报 (Daily Briefing)
                        </span>
                        {briefing.whatsappText && (
                            <button
                                onClick={() => handleCopyWhatsApp(briefing.whatsappText, 'briefing')}
                                className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs rounded-xl font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition"
                            >
                                {copiedIndex === 'briefing' ? (
                                    <>
                                        <Check className="w-3.5 h-3.5" /> 已复制 WhatsApp 格式
                                    </>
                                ) : (
                                    <>
                                        <MessageCircle className="w-3.5 h-3.5" /> 复制晨报转发群聊
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* 结论摘要 */}
                    <div className="text-sm text-zinc-200 leading-relaxed space-y-1.5 whitespace-pre-line">
                        {briefing.summary}
                    </div>

                    {/* KPI 指标卡片网格 */}
                    {briefing.kpis && briefing.kpis.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            {briefing.kpis.map((kpi, idx) => (
                                <div
                                    key={idx}
                                    className="bg-zinc-800/80 border border-zinc-700/80 rounded-2xl p-3.5 flex flex-col justify-between"
                                >
                                    <span className="text-xs font-medium text-zinc-400">{kpi.label}</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-lg font-black text-white">{kpi.value}</span>
                                        {kpi.change && (
                                            <span
                                                className={`text-[11px] font-semibold ${
                                                    kpi.tone === 'positive'
                                                        ? 'text-emerald-400'
                                                        : kpi.tone === 'negative'
                                                        ? 'text-rose-400'
                                                        : 'text-zinc-400'
                                                }`}
                                            >
                                                {kpi.change}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 对话消息区 */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {messages.length === 0 && !isQuerying && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-center text-zinc-400">
                            <Bot className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-zinc-300">有什么想了解的工厂或业务数据？</h3>
                            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                                无论是查吉兰丹送货趟数、机台停机损耗、还是查看各厂排班，随时语音或文字提问。
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                        {msg.sender === 'user' ? (
                            <div className="max-w-[85%] sm:max-w-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white px-5 py-3 rounded-3xl rounded-tr-sm shadow-md text-sm font-medium">
                                {msg.text}
                            </div>
                        ) : (
                            <div className="max-w-full sm:max-w-3xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl rounded-tl-sm p-5 shadow-xl space-y-4">
                                {/* 核心结论 */}
                                <div className="text-sm font-medium text-zinc-200 leading-relaxed whitespace-pre-line border-b border-zinc-800 pb-3">
                                    {msg.response?.summary}
                                </div>

                                {/* KPI 卡片 */}
                                {msg.response?.kpis && msg.response.kpis.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {msg.response.kpis.map((kpi, i) => (
                                            <div key={i} className="bg-zinc-800/80 p-3 rounded-2xl border border-zinc-750">
                                                <span className="text-xs text-zinc-400">{kpi.label}</span>
                                                <p className="text-base font-black text-white mt-0.5">{kpi.value}</p>
                                                {kpi.change && <span className="text-[10px] text-zinc-500">{kpi.change}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 图表展示 (SVG 条形图) */}
                                {msg.response?.chart && msg.response.chart.labels && (
                                    <div className="bg-zinc-800/60 p-4 rounded-2xl border border-zinc-700/60 space-y-2">
                                        <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                                            <BarChart3 className="w-4 h-4 text-orange-400" />
                                            {msg.response.chart.title || '数据透视分布'}
                                        </h4>
                                        <div className="space-y-2 pt-2">
                                            {msg.response.chart.labels.map((label, idx) => {
                                                const val = msg.response?.chart?.datasets[0]?.data[idx] || 0;
                                                const maxVal = Math.max(...(msg.response?.chart?.datasets[0]?.data || [1]), 1);
                                                const pct = Math.round((val / maxVal) * 100);
                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between text-xs text-zinc-300">
                                                            <span>{label}</span>
                                                            <span className="font-bold text-amber-400">{val}</span>
                                                        </div>
                                                        <div className="w-full h-2.5 bg-zinc-700/60 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 明细数据表格 */}
                                {msg.response?.table && msg.response.table.columns && (
                                    <div className="bg-zinc-800/40 rounded-2xl border border-zinc-700/50 overflow-hidden space-y-2 p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                                                <Table className="w-3.5 h-3.5 text-cyan-400" />
                                                {msg.response.table.title || '明细数据'}
                                            </span>
                                            <button
                                                onClick={() => exportTableToCsv(msg.response!.table!)}
                                                className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs rounded-lg font-semibold flex items-center gap-1 transition"
                                            >
                                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> 导出 Excel
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto max-h-56">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-zinc-800 text-zinc-400 uppercase text-[10px] sticky top-0">
                                                    <tr>
                                                        {msg.response.table.columns.map((col, ci) => (
                                                            <th key={ci} className="px-3 py-2">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800 text-zinc-300">
                                                    {msg.response.table.rows.map((row, ri) => (
                                                        <tr key={ri} className="hover:bg-zinc-800/40">
                                                            {row.map((cell, cii) => (
                                                                <td key={cii} className="px-3 py-2 whitespace-nowrap">{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* 底部行动栏与 WhatsApp 复制 */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800">
                                    {/* 可行动出口快捷按钮 */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {msg.response?.actions?.map((act, ai) => (
                                            <button
                                                key={ai}
                                                onClick={() => handleActionClick(act)}
                                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-xl font-medium border border-zinc-700 flex items-center gap-1.5 transition active:scale-95"
                                            >
                                                {act.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* 复制 WhatsApp */}
                                    {msg.response?.whatsappText && (
                                        <button
                                            onClick={() => handleCopyWhatsApp(msg.response!.whatsappText, msg.id)}
                                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs rounded-xl font-medium border border-emerald-500/30 flex items-center gap-1.5 transition"
                                        >
                                            {copiedIndex === msg.id ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" /> 已复制格式
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 className="w-3.5 h-3.5" /> 复制 WhatsApp
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* 查询思考状态 */}
                {isQuerying && (
                    <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl max-w-sm animate-pulse">
                        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-xs text-zinc-300 font-medium">正在穿透数据库分析提炼数据...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 预设灵感快捷标签 */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                {PRESET_CHIPS.map((chip, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSend(chip)}
                        className="px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full text-xs font-medium border border-zinc-800 whitespace-nowrap transition"
                    >
                        {chip}
                    </button>
                ))}
            </div>

            {/* 底部提问输入栏 */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-2.5 flex items-center gap-2 shadow-2xl backdrop-blur-md">
                <button
                    onClick={toggleSpeechRecognition}
                    className={`p-3 rounded-2xl transition ${
                        isListening
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title={isListening ? '正在录音...' : '按此说话'}
                >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-400" />}
                </button>

                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                    }}
                    placeholder="向 AI 提问任何工厂数据（例：吉兰丹上月送货多少趟？今天3号机生产了多少卷？）"
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />

                <button
                    onClick={() => handleSend()}
                    disabled={!inputText.trim() || isQuerying}
                    className="p-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 active:scale-95 text-white rounded-2xl shadow-lg transition disabled:opacity-40"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default BossCoPilot;
