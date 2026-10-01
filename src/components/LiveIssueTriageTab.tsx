import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import {
    MessageSquare, AlertTriangle, CheckCircle2, Wrench, Bug,
    Sparkles, RefreshCw, Send, Copy, Check, Truck, ShieldAlert,
    ExternalLink, X, PlusCircle, CheckCircle, Clock, ChevronDown,
    ListTodo, UserCheck, ArrowRight, Archive
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
    status: 'pending_triage' | 'actioned_task' | 'actioned_fix' | 'actioned_reply' | 'actioned_bug' | 'closed';
    task_id?: string | null;
    option_1_action: {
        title: string;
        recommended_task_title?: string;
        action_type: string;
        description: string;
        priority?: 'High' | 'Normal' | 'Low';
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

export interface LiveIssueTriageTabProps {
    currentUser?: User | null;
    usersList?: any[];
    onTaskCreated?: () => void;
    onSwitchToTasks?: () => void;
}

export const LiveIssueTriageTab: React.FC<LiveIssueTriageTabProps> = ({
    currentUser,
    usersList: propUsersList,
    onTaskCreated,
    onSwitchToTasks
}) => {
    const { t } = useTranslation();
    const [tickets, setTickets] = useState<IssueTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedTicket, setSelectedTicket] = useState<IssueTicket | null>(null);

    // Fallback users list if not passed from parent
    const [internalUsersList, setInternalUsersList] = useState<any[]>([]);
    const effectiveUsers = propUsersList && propUsersList.length > 0 ? propUsersList : internalUsersList;

    useEffect(() => {
        if (!propUsersList || propUsersList.length === 0) {
            supabase.from('users_public').select('id, name, email').order('name').then(({ data }) => {
                if (data) setInternalUsersList(data);
            });
        }
    }, [propUsersList]);

    // Task Creation Modal state (Option 1)
    const [taskModalTicket, setTaskModalTicket] = useState<IssueTicket | null>(null);
    const [taskTitleDraft, setTaskTitleDraft] = useState('');
    const [taskDescDraft, setTaskDescDraft] = useState('');
    const [taskPriority, setTaskPriority] = useState<'High' | 'Normal' | 'Low'>('Normal');
    const [taskAssignee, setTaskAssignee] = useState('');
    const [isCreatingTask, setIsCreatingTask] = useState(false);

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

        // Realtime subscription for instant updates when drivers send issues
        const channel = supabase.channel('issue_tickets_realtime_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_tickets' }, () => {
                fetchTickets();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [filterStatus]);

    // Handle Option 1: Open Task Modal
    const handleOpenOption1Modal = (ticket: IssueTicket) => {
        setTaskModalTicket(ticket);
        
        const defaultTitle = ticket.option_1_action?.recommended_task_title || 
            `[现场报障] ${ticket.ticket_number} - ${ticket.entities?.vehicle_plate ? ticket.entities.vehicle_plate + ' ' : ''}${ticket.raw_content.slice(0, 24)}`;
        setTaskTitleDraft(defaultTitle);

        const bullets = [
            `🚨 现场报障详情 (${ticket.ticket_number}):`,
            `• 提报人: ${ticket.sender_name || '员工'} (${ticket.sender_phone || '无电话'})`,
            `• 渠道来源: ${ticket.source_type === 'whatsapp_group' ? 'WhatsApp 现场沟通群' : 'WhatsApp 私聊直报'}`,
            `• 原始反馈: "${ticket.raw_content}"`,
            `• AI 3.1 Pro 诊断: ${ticket.ai_diagnosis}`,
            ticket.entities?.vehicle_plate ? `• 涉及车牌: ${ticket.entities.vehicle_plate}` : '',
            ticket.entities?.order_number ? `• 涉及单号: ${ticket.entities.order_number}` : '',
            ticket.entities?.machine_id ? `• 涉及机台: ${ticket.entities.machine_id}` : '',
            ticket.entities?.plant ? `• 厂区: ${ticket.entities.plant}` : '',
            `• 处置建议: ${ticket.option_1_action?.description || '-'}`
        ].filter(Boolean).join('\n');

        setTaskDescDraft(bullets);
        setTaskPriority(
            ticket.option_1_action?.priority ||
            (ticket.severity === 'CRITICAL' || ticket.severity === 'HIGH' ? 'High' : 'Normal')
        );
        setTaskAssignee(currentUser?.uid || '');
    };

    // Confirm Option 1: Submit to Tasks
    const handleConfirmCreateTask = async () => {
        if (!taskModalTicket) return;
        if (!taskTitleDraft.trim()) return alert('请输入任务标题');

        setIsCreatingTask(true);
        try {
            const resp = await fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: taskModalTicket.id,
                    actionOption: 1,
                    taskTitle: taskTitleDraft,
                    taskDescription: taskDescDraft,
                    priority: taskPriority,
                    assignedTo: taskAssignee,
                    userId: currentUser?.uid,
                    resolvedBy: currentUser?.name || 'Admin'
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast(res.message || '✅ 已成功转为待办任务并同步至看板！');
                setTaskModalTicket(null);
                fetchTickets();
                onTaskCreated?.();
            } else {
                alert('创建任务失败: ' + (res.error || res.message));
            }
        } catch (e: any) {
            alert('网络异常: ' + e.message);
        } finally {
            setIsCreatingTask(false);
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
                    resolvedBy: currentUser?.name || 'Admin',
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
        
        if (replyModalTicket) {
            fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: replyModalTicket.id,
                    actionOption: 2,
                    resolvedBy: `${currentUser?.name || 'Admin'} (Copied)`,
                    customReplyText: replyTextDraft,
                    sendWhatsApp: false
                })
            }).then(() => fetchTickets());
        }

        setTimeout(() => setCopiedText(false), 3000);
    };

    // Handle Option 3: Close / Archive / False Alarm
    const handleExecuteOption3 = async (ticket: IssueTicket) => {
        const reason = prompt(
            '请输入结案归档说明（如：司机已自行解决、非系统故障、已电话沟通等）:',
            '现场已沟通解决/无需进一步处理，正常结案归档。'
        );
        if (reason === null) return;

        try {
            const resp = await fetch('/api/whatsapp?action=triage-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket.id,
                    actionOption: 3,
                    resolvedBy: currentUser?.name || 'Admin',
                    resolutionNotes: reason
                })
            });
            const res = await resp.json();
            if (res.success) {
                showToast(res.message || '✅ 工单已结案归档！');
                fetchTickets();
            } else {
                alert('结案失败: ' + (res.error || res.message));
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
                return { text: '待初审决策', style: 'bg-red-500/10 text-red-400 border-red-500/20' };
            case 'actioned_task':
                return { text: '已转待办任务', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
            case 'actioned_fix':
                return { text: '已后台修复', style: 'bg-teal-500/10 text-teal-400 border-teal-500/20' };
            case 'actioned_reply':
                return { text: '已回复话术', style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
            case 'actioned_bug':
                return { text: '已转Bug待办', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
            case 'closed':
                return { text: '已结案归档', style: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
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
            <div className="bg-[#1a1a1e] p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            WhatsApp 现场报障箱
                            {pendingCount > 0 ? (
                                <span className="bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black animate-pulse shadow-md shadow-red-500/30">
                                    {pendingCount} 条待初审
                                </span>
                            ) : (
                                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                    全部已处理
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>搭载</span>
                            <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">Google Gemini 3.1 Pro</span>
                            <span>旗舰推理引擎，自动排查真实现场阻断并生成闭环决策</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Filter buttons */}
                    <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/5 text-xs">
                        {[
                            { key: 'all', label: '全部' },
                            { key: 'pending_triage', label: '待处理' },
                            { key: 'actioned_task', label: '已转任务' },
                            { key: 'actioned_reply', label: '已回复' },
                            { key: 'closed', label: '已结案' },
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
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-300 hover:text-white transition active:scale-95"
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
                            <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-fade-in">
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
                <div className="text-center py-16 bg-[#1a1a1e]/60 border border-white/5 rounded-3xl p-8 shadow-inner">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3 opacity-80" />
                    <h3 className="text-base font-bold text-white">当前暂无待处理现场工单</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        工厂现场群聊中的阻断投诉与 Bug 在被 AI 3.1 Pro 捕获后会自动实时呈现在这里。你可以点击右上角「🧪 模拟入库测试」体验完整指挥官决策闭环。
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
                            className={`rounded-3xl p-5 border transition-all duration-200 shadow-xl ${
                                isPending
                                    ? 'bg-[#1a1a1e] border-amber-500/40 hover:border-amber-500/70 shadow-amber-500/5'
                                    : 'bg-[#1a1a1e]/60 border-white/5 opacity-90'
                            }`}
                        >
                            {/* Card Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/20">
                                        {ticket.ticket_number}
                                    </span>
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${getSeverityBadge(ticket.severity)}`}>
                                        {ticket.severity} 优先级
                                    </span>
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${st.style}`}>
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
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                                            {(ticket.sender_name || 'U')[0]}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white flex items-center gap-2">
                                                <span>{ticket.sender_name || '现场用户'}</span>
                                                {ticket.sender_phone && (
                                                    <span className="text-slate-400 font-normal">({ticket.sender_phone})</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                渠道: {ticket.source_type === 'whatsapp_group' ? 'WhatsApp 现场运营群' : 'WhatsApp 私信提报'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Raw Chat Bubble */}
                                    <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl text-xs text-emerald-100 font-medium leading-relaxed relative">
                                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">
                                            群聊原始提报内容:
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
                                <div className="lg:col-span-6 bg-gradient-to-br from-indigo-950/30 via-slate-900 to-[#121215] p-4 rounded-2xl border border-indigo-500/20 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold text-xs">
                                            <Sparkles size={16} />
                                            <span>Gemini 3.1 Pro 现场排障与技术诊断</span>
                                        </div>
                                        <p className="text-xs text-slate-200 leading-relaxed font-normal whitespace-pre-line">
                                            {ticket.ai_diagnosis}
                                        </p>
                                    </div>

                                    {/* Resolution summary if completed */}
                                    {ticket.resolution_notes && (
                                        <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                                            <CheckCircle size={14} className="shrink-0" />
                                            <span>{ticket.resolution_notes}</span>
                                            {ticket.task_id && onSwitchToTasks && (
                                                <button
                                                    onClick={onSwitchToTasks}
                                                    className="ml-auto text-blue-400 hover:text-blue-300 underline font-bold flex items-center gap-1"
                                                >
                                                    <span>查看任务</span>
                                                    <ArrowRight size={12} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3 Action Buttons Toolbar */}
                            <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Option 1: 1-Click Convert to Real Task */}
                                <button
                                    onClick={() => handleOpenOption1Modal(ticket)}
                                    disabled={!isPending}
                                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                                        isPending
                                            ? 'bg-emerald-950/30 hover:bg-emerald-900/50 border-emerald-500/40 text-white cursor-pointer active:scale-98 shadow-md'
                                            : 'bg-white/5 border-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                                            <ListTodo size={14} />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-300">
                                            选项 1: 转为待办任务 (我的清单)
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-white mb-1 line-clamp-1">
                                        {ticket.option_1_action?.recommended_task_title || ticket.option_1_action?.title || '自动建立待办跟进'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-2">
                                        {ticket.option_1_action?.description || '将现场异常正式写入系统 Tasks 看板，支持指派团队负责人排查闭环。'}
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

                                {/* Option 3: Close / Archive / False Alarm */}
                                <button
                                    onClick={() => handleExecuteOption3(ticket)}
                                    disabled={!isPending}
                                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                                        isPending
                                            ? 'bg-slate-800 hover:bg-slate-700/80 border-white/10 text-white cursor-pointer active:scale-98'
                                            : 'bg-white/5 border-white/5 text-slate-400 opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1 rounded-lg bg-gray-500/20 text-gray-400">
                                            <Archive size={14} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-300">
                                            选项 3: 口头解决 / 结案归档
                                        </span>
                                    </div>
                                    <div className="text-[13px] font-bold text-white mb-1 line-clamp-1">
                                        直接结案销号
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-2">
                                        如司机已自行解决、误操作提报或已电话沟通，可一键完成归档。
                                    </div>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal: Option 1 Task Creation Modal */}
            {taskModalTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#1a1a1e] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <ListTodo size={18} />
                                <span>转为系统待办任务 (Tasks)</span>
                            </div>
                            <button
                                onClick={() => setTaskModalTicket(null)}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Task Title */}
                        <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1.5">
                                任务标题 (Title):
                            </label>
                            <input
                                type="text"
                                value={taskTitleDraft}
                                onChange={(e) => setTaskTitleDraft(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                placeholder="输入待办任务标题..."
                            />
                        </div>

                        {/* Priority & Assignee Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                                    优先级 (Priority):
                                </label>
                                <select
                                    value={taskPriority}
                                    onChange={(e) => setTaskPriority(e.target.value as any)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="High">🔴 高优先级 (High)</option>
                                    <option value="Normal">🟡 标准 (Normal)</option>
                                    <option value="Low">🔵 低 (Low)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                                    指派给 (Assignee):
                                </label>
                                <select
                                    value={taskAssignee}
                                    onChange={(e) => setTaskAssignee(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value={currentUser?.uid || ''}>我自己 ({currentUser?.name || '当前用户'})</option>
                                    {effectiveUsers
                                        .filter(u => u.id !== currentUser?.uid)
                                        .map(u => (
                                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Task Description Draft */}
                        <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1.5">
                                任务详情与诊断要点 (Description):
                            </label>
                            <textarea
                                value={taskDescDraft}
                                onChange={(e) => setTaskDescDraft(e.target.value)}
                                rows={6}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-emerald-500 focus:outline-none font-mono"
                            />
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setTaskModalTicket(null)}
                                className="flex-1 py-2.5 rounded-xl font-bold text-xs text-gray-400 hover:text-white hover:bg-white/5 transition"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCreateTask}
                                disabled={isCreatingTask}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Check size={16} />
                                <span>{isCreatingTask ? '正在写入任务看板...' : '确认转为我的待办任务'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
