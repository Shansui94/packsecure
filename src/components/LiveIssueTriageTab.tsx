import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import {
    MessageSquare, AlertTriangle, CheckCircle2, Wrench, Bug,
    Sparkles, RefreshCw, Send, Copy, Check, Truck, ShieldAlert,
    ExternalLink, X, PlusCircle, CheckCircle, Clock, ChevronDown
} from 'lucide-react';
import { useTranslation } from "react-i18next";

export interface IssueTicket {
    id: string;
    ticket_number: string;
    source_group_id?: string | null;
    source_type?: string;
    sender_name?: string | null;
    sender_phone?: string | null;
    employee_id?: string | null;
    raw_content: string;
    photo_url?: string | null;
    entities: {
        vehicle_plate?: string;
        order_number?: string;
        machine_id?: string;
        plant?: string;
        driver_name?: string;
        issue_type?: string;
    };
    ai_diagnosis: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'pending_triage' | 'actioned_fix' | 'actioned_reply' | 'actioned_bug' | 'closed';
    option_1_action: {
        title: string;
        action_type: string;
        description: string;
        target_entity_id?: string;
    };
    option_2_reply: {
        title: string;
        reply_text: string;
        text_ms?: string;
        text_zh?: string;
    };
    option_3_bug: {
        title: string;
        bug_title: string;
        module: string;
        description: string;
    };
    resolved_by?: string | null;
    resolved_at?: string | null;
    resolution_notes?: string | null;
    created_at: string;
}

export const LiveIssueTriageTab: React.FC = () => {
    const { t } = useTranslation();
    const [tickets, setTickets] = useState<IssueTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedTicket, setSelectedTicket] = useState<IssueTicket | null>(null);

    // Reply Modal state (Option 2)
    const [replyModalTicket, setReplyModalTicket] = useState<IssueTicket | null>(null);
    const [replyTextDraft, setReplyTextDraft] = useState('');
    const [isSendingWa, setIsSendingWa] = useState(false);
    const [copiedText, setCopiedText] = useState(false);

    // Image preview modal
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

    // Simulating test ticket state
    const [isSimulating, setIsSimulating] = useState(false);
    const [showSimulateMenu, setShowSimulateMenu] = useState(false);

    // Notification toast
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`/api/whatsapp?action=triage-list&status=${filterStatus}`);
            if (resp.ok) {
                const json = await resp.json();
                if (json.tickets) {
                    setTickets(json.tickets);
                    return;
                }
            }
            // Direct Supabase fallback
            let query = supabase.from('issue_tickets').select('*').order('created_at', { ascending: false });
            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }
            const { data } = await query;
            setTickets((data || []) as IssueTicket[]);
        } catch (err: any) {
            console.error('Fetch tickets error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [filterStatus]);

    // Handle Option 1: One-Click Data Fix
    const handleExecuteOption1 = async (ticket: IssueTicket) => {
        if (!confirm(`确定执行【选项 1】: ${ticket.option_1_action?.title || '一键后台修复'}？`)) return;

        try {
            const resp = await fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    actionOption: 1,
                    resolvedBy: 'Admin'
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast(res.message || '✅ 选项 1 执行成功！');
                fetchTickets();
            } else {
                alert('执行失败: ' + (res.error || res.message));
            }
        } catch (e: any) {
            alert('网络异常: ' + e.message);
        }
    };

    // Handle Option 2: Open Reply Modal
    const handleOpenOption2Modal = (ticket: IssueTicket) => {
        setReplyModalTicket(ticket);
        setReplyTextDraft(ticket.option_2_reply?.reply_text || '');
        setCopiedText(false);
    };

    // Send WhatsApp Reply via API
    const handleSendWhatsAppReply = async () => {
        if (!replyModalTicket) return;
        setIsSendingWa(true);
        try {
            const resp = await fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: replyModalTicket.id,
                    actionOption: 2,
                    resolvedBy: 'Admin',
                    customReplyText: replyTextDraft,
                    sendWhatsApp: true
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast('✅ 已成功通过 WhatsApp 发送回复并结案！');
                setReplyModalTicket(null);
                fetchTickets();
            } else {
                alert('发送失败: ' + (res.error || res.message));
            }
        } catch (e: any) {
            alert('发送异常: ' + e.message);
        } finally {
            setIsSendingWa(false);
        }
    };

    // Copy Reply Text
    const handleCopyReplyText = async () => {
        if (!replyTextDraft) return;
        await navigator.clipboard.writeText(replyTextDraft);
        setCopiedText(true);
        showToast('📋 已复制话术到剪贴板，可直接在手机 WhatsApp 群里粘贴！');
        
        // Also update ticket status to actioned_reply
        if (replyModalTicket) {
            fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: replyModalTicket.id,
                    actionOption: 2,
                    resolvedBy: 'Admin (Copied)',
                    customReplyText: replyTextDraft,
                    sendWhatsApp: false
                })
            }).then(() => fetchTickets());
        }

        setTimeout(() => setCopiedText(false), 3000);
    };

    // Handle Option 3: Escalate to Bug
    const handleExecuteOption3 = async (ticket: IssueTicket) => {
        if (!confirm(`确定执行【选项 3】: 将此问题登记为系统代码 Bug 并同步 DevLog？\n标题: ${ticket.option_3_bug?.bug_title}`)) return;

        try {
            const resp = await fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    actionOption: 3,
                    resolvedBy: 'Admin'
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast(res.message || '✅ 已成功登记为系统代码 Bug 并更新至 DevLog！');
                fetchTickets();
            } else {
                alert('登记失败: ' + (res.error || res.message));
            }
        } catch (e: any) {
            alert('网络异常: ' + e.message);
        }
    };

    // Simulate Sample Ticket
    const handleSimulateTicket = async (scenario: string) => {
        setIsSimulating(true);
        setShowSimulateMenu(false);
        try {
            const resp = await fetch('/api/whatsapp?action=triage-simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario })
            });
            const res = await resp.json();
            if (res.success && res.ticket) {
                showToast(`🧪 成功模拟入库测试工单: ${res.ticket.ticket_number}`);
                fetchTickets();
            } else {
                alert('模拟失败: ' + (res.error || '未知错误'));
            }
        } catch (e: any) {
            alert('网络异常: ' + e.message);
        } finally {
            setIsSimulating(false);
        }
    };

    // Severity styling
    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case 'CRITICAL':
                return 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse';
            case 'HIGH':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'MEDIUM':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            default:
                return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        }
    };

    // Status styling
    const getStatusBadge = (st: string) => {
        switch (st) {
            case 'pending_triage':
                return { text: '待初审处理', style: 'bg-red-500/10 text-red-400 border-red-500/20' };
            case 'actioned_fix':
                return { text: '已后台修复', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
            case 'actioned_reply':
                return { text: '已回复话术', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
            case 'actioned_bug':
                return { text: '已转Bug代码待办', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
            case 'closed':
                return { text: '已手动结案', style: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
            default:
                return { text: st, style: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
        }
    };

    const pendingCount = tickets.filter(t => t.status === 'pending_triage').length;

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 animate-slide-up">
                    <CheckCircle2 size={20} className="shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            WhatsApp 现场报障与工单看板
                            {pendingCount > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black animate-pulse">
                                    {pendingCount} 待初审
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            由 AI 自动抓取群聊报错，过滤日常闲聊，呈现智能 3 选项快速闭环
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Filter buttons */}
                    <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/5 text-xs">
                        {[
                            { key: 'all', label: '全部' },
                            { key: 'pending_triage', label: '待处理' },
                            { key: 'actioned_fix', label: '已修复' },
                            { key: 'actioned_reply', label: '已回复' },
                            { key: 'actioned_bug', label: '转Bug' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterStatus(f.key)}
                                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                                    filterStatus === f.key
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchTickets}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 hover:text-white transition"
                        title="刷新工单列表"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-400' : ''} />
                    </button>

                    {/* Simulate Test Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSimulateMenu(!showSimulateMenu)}
                            disabled={isSimulating}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
                        >
                            <Sparkles size={14} />
                            <span>{isSimulating ? '模拟入库中...' : '🧪 模拟入库测试'}</span>
                            <ChevronDown size={14} />
                        </button>

                        {showSimulateMenu && (
                            <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                                <div className="text-[10px] text-slate-400 font-bold px-3 py-1.5 uppercase tracking-wider">
                                    选择要模拟的经典现场故障:
                                </div>
                                <button
                                    onClick={() => handleSimulateTicket('overload')}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                    <span>🚚</span> <span>Lori 9821 装车超限 (65卷)</span>
                                </button>
                                <button
                                    onClick={() => handleSimulateTicket('pod_missing')}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                    <span>📸</span> <span>送达缺少签收单点不了完成</span>
                                </button>
                                <button
                                    onClick={() => handleSimulateTicket('night_shift')}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                    <span>🌙</span> <span>夜班时薪与打卡规则疑问</span>
                                </button>
                                <button
                                    onClick={() => handleSimulateTicket('machine_leak')}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-white hover:bg-white/10 rounded-xl transition flex items-center gap-2"
                                >
                                    <span>🏭</span> <span>T1-M03 气泡漏气及条码异常</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {!loading && tickets.length === 0 && (
                <div className="text-center py-16 bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-80" />
                    <h3 className="text-base font-bold text-white">当前暂无待处理工单</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        群聊中的投诉与 Bug 会在被 AI 捕获后自动实时出现在这里。你也可以点击右上角「🧪 模拟入库测试」体验完整三选一流程。
                    </p>
                </div>
            )}

            {/* Ticket Cards List */}
            <div className="space-y-4">
                {tickets.map(ticket => {
                    const st = getStatusBadge(ticket.status);
                    const isPending = ticket.status === 'pending_triage';

                    return (
                        <div
                            key={ticket.id}
                            className={`rounded-3xl p-5 border transition shadow-lg ${
                                isPending
                                    ? 'bg-slate-900/90 border-amber-500/30 hover:border-amber-500/60'
                                    : 'bg-slate-900/50 border-white/10 opacity-90'
                            }`}
                        >
                            {/* Card Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                                        {ticket.ticket_number}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getSeverityBadge(ticket.severity)}`}>
                                        {ticket.severity} 优先级
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${st.style}`}>
                                        {st.text}
                                    </span>
                                </div>

                                <div className="text-xs text-slate-400 flex items-center gap-2">
                                    <Clock size={12} />
                                    <span>{new Date(ticket.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })}</span>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-4">
                                {/* Left: User Message & Screenshot */}
                                <div className="lg:col-span-6 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                                            {(ticket.sender_name || 'U')[0]}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white">
                                                {ticket.sender_name || '现场用户'}
                                                {ticket.sender_phone && (
                                                    <span className="text-slate-400 font-normal ml-1">({ticket.sender_phone})</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                来源: {ticket.source_type === 'whatsapp_group' ? 'WhatsApp 沟通群' : 'WhatsApp 私聊直报'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Raw Chat Bubble */}
                                    <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl text-xs text-emerald-100 font-medium leading-relaxed relative">
                                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">
                                            群聊原始报障文字:
                                        </span>
                                        "{ticket.raw_content}"
                                    </div>

                                    {/* Extracted Entities */}
                                    {ticket.entities && Object.keys(ticket.entities).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {ticket.entities.vehicle_plate && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                                    🚚 车牌: {ticket.entities.vehicle_plate}
                                                </span>
                                            )}
                                            {ticket.entities.order_number && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                    📦 单号: {ticket.entities.order_number}
                                                </span>
                                            )}
                                            {ticket.entities.machine_id && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                    🏭 机台: {ticket.entities.machine_id}
                                                </span>
                                            )}
                                            {ticket.entities.plant && (
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/20">
                                                    📍 厂区: {ticket.entities.plant}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Photo preview thumbnail */}
                                    {ticket.photo_url && (
                                        <div className="pt-2">
                                            <button
                                                onClick={() => setPreviewPhotoUrl(ticket.photo_url!)}
                                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-bold"
                                            >
                                                <span>🖼️ 查看用户上传的报错截图</span>
                                                <ExternalLink size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Right: AI Diagnosis & Root Cause */}
                                <div className="lg:col-span-6 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-900 p-4 rounded-2xl border border-indigo-500/20 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold text-xs">
                                            <Sparkles size={16} />
                                            <span>AI 现场排障与技术诊断备忘录</span>
                                        </div>
                                        <p className="text-xs text-slate-200 leading-relaxed font-normal">
                                            {ticket.ai_diagnosis}
                                        </p>
                                    </div>

                                    {/* Resolution summary if completed */}
                                    {ticket.resolution_notes && (
                                        <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                                            <CheckCircle size={14} className="shrink-0" />
                                            <span>{ticket.resolution_notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3 Action Buttons Toolbar */}
                            <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Option 1: Data Fix */}
                                <button
                                    onClick={() => handleExecuteOption1(ticket)}
                                    disabled={!isPending}
                                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                                        isPending
                                            ? 'bg-emerald-950/30 hover:bg-emerald-900/50 border-emerald-500/30 text-white cursor-pointer active:scale-98'
                                            : 'bg-white/5 border-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <Wrench size={14} />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-300">
                                            选项 1: 一键后台修复
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-white mb-1 line-clamp-1">
                                        {ticket.option_1_action?.title || '后台自动修正状态'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-2">
                                        {ticket.option_1_action?.description || '直接在后台解除校验锁定并同步数据。'}
                                    </div>
                                </button>

                                {/* Option 2: Grounded Reply */}
                                <button
                                    onClick={() => handleOpenOption2Modal(ticket)}
                                    className="p-3.5 rounded-2xl border text-left transition flex flex-col justify-between bg-blue-950/30 hover:bg-blue-900/50 border-blue-500/30 text-white cursor-pointer active:scale-98"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
                                            <MessageSquare size={14} />
                                        </div>
                                        <span className="text-xs font-bold text-blue-300">
                                            选项 2: 接地气回复话术
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-white mb-1 line-clamp-1">
                                        {ticket.option_2_reply?.title || '双语现场指导话术'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-2">
                                        提供中马双语地道解释，支持一键发送回 WhatsApp 群或快速复制。
                                    </div>
                                </button>

                                {/* Option 3: Escalate to Bug */}
                                <button
                                    onClick={() => handleExecuteOption3(ticket)}
                                    disabled={!isPending}
                                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                                        isPending
                                            ? 'bg-purple-950/30 hover:bg-purple-900/50 border-purple-500/30 text-white cursor-pointer active:scale-98'
                                            : 'bg-white/5 border-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded-lg bg-purple-500/20 text-purple-400">
                                            <Bug size={14} />
                                        </div>
                                        <span className="text-xs font-bold text-purple-300">
                                            选项 3: 登记为代码 Bug
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-white mb-1 line-clamp-1">
                                        {ticket.option_3_bug?.bug_title || '转入 DevLog 待修复'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-2">
                                        自动归档为系统缺陷，并同步至系统开发升级排期日志。
                                    </div>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal: Option 2 Reply Dispatch & Copy */}
            {replyModalTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                                <MessageSquare size={18} />
                                <span>{replyModalTicket.option_2_reply?.title || '现场指导回复话术'}</span>
                            </div>
                            <button
                                onClick={() => setReplyModalTicket(null)}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Ticket Context */}
                        <div className="p-3 bg-white/5 rounded-2xl text-xs space-y-1 text-slate-300">
                            <div><b>单号</b>: {replyModalTicket.ticket_number}</div>
                            <div><b>提报人</b>: {replyModalTicket.sender_name} ({replyModalTicket.sender_phone || '无电话'})</div>
                            <div><b>原话</b>: "{replyModalTicket.raw_content}"</div>
                        </div>

                        {/* Reply Draft Editor */}
                        <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1.5">
                                回发话术草稿 (可直接修改):
                            </label>
                            <textarea
                                value={replyTextDraft}
                                onChange={(e) => setReplyTextDraft(e.target.value)}
                                rows={4}
                                className="w-full bg-black/50 border border-white/10 rounded-2xl p-3 text-xs text-white leading-relaxed focus:border-blue-500 focus:outline-none"
                            />
                            {replyModalTicket.option_2_reply?.text_zh && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                    💡 中文参考: {replyModalTicket.option_2_reply.text_zh}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                onClick={handleCopyReplyText}
                                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95"
                            >
                                {copiedText ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                <span>{copiedText ? '已复制话术！' : '一键复制文字'}</span>
                            </button>

                            <button
                                onClick={handleSendWhatsAppReply}
                                disabled={isSendingWa}
                                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50"
                            >
                                <Send size={16} />
                                <span>{isSendingWa ? '正在发送...' : '发送到 WhatsApp 群'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Photo Preview */}
            {previewPhotoUrl && (
                <div
                    onClick={() => setPreviewPhotoUrl(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
                >
                    <div className="relative max-w-2xl max-h-[85vh] p-2 bg-slate-900 border border-white/20 rounded-3xl overflow-hidden">
                        <img
                            src={previewPhotoUrl}
                            alt="Bug Screenshot"
                            className="max-h-[80vh] w-auto object-contain rounded-2xl mx-auto"
                        />
                        <button
                            onClick={() => setPreviewPhotoUrl(null)}
                            className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded-full hover:bg-black"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
