import { useState, useEffect, useMemo, useRef } from 'react';
import {
    BookOpen, Plus, Pencil, Trash2, X,
    ChevronLeft, FileText, Search, Save,
    Printer, CheckSquare, Square, ExternalLink,
    Sparkles, Bot, Play, LayoutGrid, List, Eye,
    AlertTriangle, Info, CheckCircle2, AlertCircle,
    Languages, Wrench, Truck, Boxes, Users, ShieldCheck,
    Factory, ChevronRight, Copy, Check, RotateCcw,
    Send, Undo2, PanelLeftClose, PanelLeftOpen, MessageSquare,
    Image as ImageIcon, Film, Paperclip, Upload, Loader2, Camera
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../services/supabase';
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SOPArticle {
    id: string;
    title: string;
    description: string;
    content: string;
    video_url?: string;
    page_id?: string;
    target_roles: string[];
    sort_order?: number;
    is_published: boolean;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
    category?: string;
}

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: Date;
    photoUrl?: string;
}

interface SOPCenterProps {
    userRole?: string;
    user?: any;
    onNavigate?: (page: string) => void;
}

const ALL_ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Operator', 'Driver', 'HR'];

const ROLE_COLORS: Record<string, string> = {
    SuperAdmin: '#ef4444',
    Admin: '#3b82f6',
    Manager: '#8b5cf6',
    Operator: '#f59e0b',
    Driver: '#10b981',
    HR: '#ec4899',
};

// ─── System Page Directory for Deep-Linking ──────────────────────────────────
export const SYSTEM_PAGES = [
    { id: 'scanner', name: '生产控制台 (Production Workspace)', category: 'production' },
    { id: 'raw_material_mobile', name: '混料与多螺杆 (Material Mixing)', category: 'production' },
    { id: 'machine-schedule', name: '机台排程 (Machine Schedule)', category: 'production' },
    { id: 'machine-labels', name: '机器二维码标签 (Machine QR Labels)', category: 'equipment' },
    { id: 'floor-plan', name: '车间平面图 (Floor Plan)', category: 'production' },
    { id: 'recipes', name: '配方与AI学习 (Yield Control)', category: 'production' },
    { id: 'livestock', name: '实时成品库存 (Live Stock)', category: 'inventory' },
    { id: 'inventory', name: '全局库存清单 (Global Inventory)', category: 'inventory' },
    { id: 'stock-movement', name: '库存调拨 (Stock Movement)', category: 'inventory' },
    { id: 'stock-audit', name: '库存盘点 (Stock Audit)', category: 'inventory' },
    { id: 'audit-report', name: '盘点报告 (Audit Report)', category: 'inventory' },
    { id: 'products', name: '产品资料库 (Product Library)', category: 'inventory' },
    { id: 'delivery', name: '出货调度派车 (Trip Management)', category: 'logistics' },
    { id: 'delivery-driver', name: '司机端配送打卡 (Driver Portal)', category: 'logistics' },
    { id: 'delivery-history', name: '送货历史单据 (Delivery History)', category: 'logistics' },
    { id: 'order-summary', name: '每日配货看板 (Daily Prep)', category: 'logistics' },
    { id: 'lorry-service', name: '卡车维保记录 (Lorry Service)', category: 'equipment' },
    { id: 'maintenance', name: '综合维保管理 (Maintenance Control)', category: 'equipment' },
    { id: 'lorry-management', name: '车队资产档案 (Lorry Fleet)', category: 'logistics' },
    { id: 'leave-calendar', name: '员工请假中心 (Staff Hub)', category: 'hr' },
    { id: 'hr', name: 'HR 人事管理 (HR Control Center)', category: 'hr' },
    { id: 'work-photos', name: '工作拍照日志 (Work Photos)', category: 'production' },
    { id: 'activity-logs', name: '系统活动日志 (Activity Logs)', category: 'hr' },
    { id: 'tasks', name: '任务协作 (Tasks)', category: 'hr' },
    { id: 'notes', name: '便签与记事 (Notes)', category: 'hr' },
];

export const CATEGORIES = [
    { id: 'all', label: '全部规程', icon: BookOpen, color: 'text-indigo-400' },
    { id: 'production', label: '生产工艺', icon: Factory, color: 'text-amber-400' },
    { id: 'equipment', label: '设备维保', icon: Wrench, color: 'text-blue-400' },
    { id: 'logistics', label: '物流配送', icon: Truck, color: 'text-emerald-400' },
    { id: 'inventory', label: '仓储盘点', icon: Boxes, color: 'text-purple-400' },
    { id: 'hr', label: '人事行政', icon: Users, color: 'text-pink-400' },
    { id: 'safety', label: '品质安全', icon: ShieldCheck, color: 'text-red-400' },
];

// Helper to infer or assign category based on title, content, or page_id
function inferCategory(article: Partial<SOPArticle>): string {
    if (article.category) return article.category;
    const pid = article.page_id || '';
    if (['scanner', 'raw_material_mobile', 'recipes', 'floor-plan', 'work-photos'].includes(pid)) return 'production';
    if (['machine-labels', 'machine-schedule', 'lorry-service', 'maintenance'].includes(pid)) return 'equipment';
    if (['delivery', 'delivery-driver', 'delivery-history', 'order-summary', 'lorry-management'].includes(pid)) return 'logistics';
    if (['inventory', 'livestock', 'stock-movement', 'stock-audit', 'audit-report', 'products'].includes(pid)) return 'inventory';
    if (['leave-calendar', 'hr', 'activity-logs', 'tasks', 'notes'].includes(pid)) return 'hr';

    const text = ((article.title || '') + ' ' + (article.description || '') + ' ' + (article.content || '')).toLowerCase();
    if (/安全|防护|ppe|急停|危险|hazard|safety|kemalangan/i.test(text)) return 'safety';
    if (/卡车|司机|送货|交单|lorry|driver|penghantaran|drop|trip/i.test(text)) return 'logistics';
    if (/请假|假期|hr|cuti|leave|报销|claim|attendance|考勤/i.test(text)) return 'hr';
    if (/机器|机台|设备|调整|换卷|螺杆|气泡膜|bubblewrap|stretch|拉伸膜|mesin|line/i.test(text)) return 'production';
    if (/维修|保养|标签|servis|maintenance|label|qr/i.test(text)) return 'equipment';
    if (/库存|盘点|调拨|stok|inventory|warehouse/i.test(text)) return 'inventory';

    return 'production';
}

// ─── Custom Markdown Renderer Components ─────────────────────────────────────
const MarkdownComponents = {
    h1: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h1 id={id} className="text-2xl font-black text-white mt-8 mb-4 pb-2 border-b border-gray-800 flex items-center gap-2" {...props}>{children}</h1>;
    },
    h2: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h2 id={id} className="text-xl font-extrabold text-indigo-300 mt-7 mb-3 flex items-center gap-2" {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-');
        return <h3 id={id} className="text-base font-bold text-gray-200 mt-5 mb-2" {...props}>{children}</h3>;
    },
    blockquote: ({ node, children, ...props }: any) => {
        const childArray = Array.isArray(children) ? children : [children];
        const flatText = childArray.map(c => typeof c === 'string' ? c : (c?.props?.children || '')).join('');

        if (flatText.includes('[!NOTE]')) {
            return (
                <div className="my-4 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-blue-200 text-sm flex gap-3 shadow-md shadow-blue-500/5">
                    <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!TIP]')) {
            return (
                <div className="my-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-200 text-sm flex gap-3 shadow-md shadow-emerald-500/5">
                    <Sparkles size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!IMPORTANT]')) {
            return (
                <div className="my-4 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 text-purple-200 text-sm flex gap-3 shadow-md shadow-purple-500/5">
                    <AlertCircle size={20} className="text-purple-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!WARNING]')) {
            return (
                <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-amber-200 text-sm flex gap-3 shadow-md shadow-amber-500/5">
                    <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }
        if (flatText.includes('[!CAUTION]')) {
            return (
                <div className="my-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-200 text-sm flex gap-3 shadow-md shadow-red-500/5">
                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{children}</div>
                </div>
            );
        }

        return (
            <blockquote className="my-4 border-l-4 border-indigo-500 bg-gray-900/40 px-4 py-2 text-gray-300 text-sm italic rounded-r-xl" {...props}>
                {children}
            </blockquote>
        );
    },
    table: ({ node, children, ...props }: any) => (
        <div className="overflow-x-auto my-5 rounded-xl border border-gray-800 bg-gray-950/60 shadow-inner">
            <table className="min-w-full divide-y divide-gray-800 text-sm text-left text-gray-300" {...props}>
                {children}
            </table>
        </div>
    ),
    th: ({ node, children, ...props }: any) => (
        <th className="px-4 py-3 bg-gray-900/80 font-black text-gray-200 text-xs tracking-wider uppercase" {...props}>
            {children}
        </th>
    ),
    td: ({ node, children, ...props }: any) => (
        <td className="px-4 py-3 border-t border-gray-800/60 text-xs leading-relaxed" {...props}>
            {children}
        </td>
    ),
    ul: ({ node, children, ...props }: any) => <ul className="list-disc ml-5 space-y-1 my-2 text-gray-300 text-sm" {...props}>{children}</ul>,
    ol: ({ node, children, ...props }: any) => <ol className="list-decimal ml-5 space-y-1.5 my-2 text-gray-300 text-sm" {...props}>{children}</ol>,
    li: ({ node, children, ...props }: any) => <li className="leading-relaxed" {...props}>{children}</li>,
    p: ({ node, children, ...props }: any) => {
        const str = String(children);
        if (str.startsWith('[!NOTE]') || str.startsWith('[!TIP]') || str.startsWith('[!IMPORTANT]') || str.startsWith('[!WARNING]') || str.startsWith('[!CAUTION]')) {
            const clean = str.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/, '');
            return <p className="mb-2 leading-relaxed text-gray-200">{clean}</p>;
        }
        return <p className="mb-3 leading-relaxed text-gray-300 text-sm" {...props}>{children}</p>;
    },
    img: ({ node, src, alt, ...props }: any) => (
        <div className="my-5 rounded-2xl overflow-hidden border border-gray-800 bg-gray-900/60 shadow-lg group">
            <img
                src={src}
                alt={alt || 'SOP 规范插图'}
                className="w-full max-h-[500px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                loading="lazy"
                {...props}
            />
            {alt && <p className="text-center text-xs text-gray-400 py-2.5 bg-gray-900/80 border-t border-gray-800/80 font-medium">{alt}</p>}
        </div>
    ),
    code: ({ node, inline, children, ...props }: any) => {
        if (inline) {
            return <code className="px-1.5 py-0.5 rounded bg-gray-800/80 border border-gray-700/60 text-indigo-300 font-mono text-xs" {...props}>{children}</code>;
        }
        return (
            <div className="relative my-4 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 font-mono text-xs">
                <pre className="p-4 text-gray-300 overflow-x-auto leading-relaxed">{children}</pre>
            </div>
        );
    },
    hr: () => <hr className="my-6 border-gray-800/80" />,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SOPCenter({ userRole, user, onNavigate }: SOPCenterProps) {
    const { t } = useTranslation();
    const [articles, setArticles] = useState<SOPArticle[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchTerm, setSearchTerm] = useState(() => {
        const stored = localStorage.getItem('sop_center_search_term');
        if (stored) {
            localStorage.removeItem('sop_center_search_term');
            return stored;
        }
        return '';
    });
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [roleFilter, setRoleFilter] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Detail & Mode states
    const [selectedArticle, setSelectedArticle] = useState<SOPArticle | null>(null);
    const [isChecklistMode, setIsChecklistMode] = useState(false);
    const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});

    // Admin Copilot Workspace states
    const [isEditing, setIsEditing] = useState(false);
    const [editArticle, setEditArticle] = useState<Partial<SOPArticle> | null>(null);
    const [editorTab, setEditorTab] = useState<'write' | 'split' | 'preview'>('split');
    const [copilotOpen, setCopilotOpen] = useState(true);

    // AI Chat Copilot Stream, Photo Attachment & Undo State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const [undoStack, setUndoStack] = useState<Partial<SOPArticle>[]>([]);
    const [aiAttachedPhoto, setAiAttachedPhoto] = useState<{ file: File; preview: string; base64: string } | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const fileInputImageRef = useRef<HTMLInputElement>(null);
    const fileInputVideoRef = useRef<HTMLInputElement>(null);
    const fileInputAiPhotoRef = useRef<HTMLInputElement>(null);

    const isAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || user?.employeeId === '001';

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sop_articles')
                .select('*')
                .order('sort_order', { ascending: true });

            if (!error && data) {
                const enhanced = data.map((art: any) => ({
                    ...art,
                    category: inferCategory(art)
                }));
                setArticles(enhanced);
            }
        } catch (err) {
            console.error('Failed to load SOP articles:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter visible articles
    const filteredArticles = useMemo(() => {
        return articles.filter(a => {
            if (!isAdmin) {
                if (!a.is_published) return false;
                if (a.target_roles && a.target_roles.length > 0 && userRole && !a.target_roles.includes(userRole)) {
                    return false;
                }
            }
            if (roleFilter !== 'All') {
                if (!a.target_roles || !a.target_roles.includes(roleFilter)) return false;
            }
            if (selectedCategory !== 'all') {
                if (a.category !== selectedCategory) return false;
            }
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchTitle = (a.title || '').toLowerCase().includes(q);
                const matchDesc = (a.description || '').toLowerCase().includes(q);
                const matchPage = (a.page_id || '').toLowerCase().includes(q);
                const matchContent = (a.content || '').toLowerCase().includes(q);
                return matchTitle || matchDesc || matchPage || matchContent;
            }
            return true;
        });
    }, [articles, isAdmin, userRole, roleFilter, selectedCategory, searchTerm]);

    const stats = useMemo(() => {
        const total = articles.length;
        const published = articles.filter(a => a.is_published).length;
        const forMyRole = userRole ? articles.filter(a => !a.target_roles || a.target_roles.length === 0 || a.target_roles.includes(userRole)).length : total;
        const withPages = articles.filter(a => a.page_id && a.page_id.trim()).length;
        return { total, published, forMyRole, withPages };
    }, [articles, userRole]);

    const tableOfContents = useMemo(() => {
        if (!selectedArticle?.content) return [];
        const lines = selectedArticle.content.split('\n');
        const headings: { level: number; text: string; id: string }[] = [];

        lines.forEach(line => {
            const h1Match = line.match(/^#\s+(.+)$/);
            const h2Match = line.match(/^##\s+(.+)$/);
            const h3Match = line.match(/^###\s+(.+)$/);

            if (h1Match) {
                const text = h1Match[1].trim();
                headings.push({ level: 1, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            } else if (h2Match) {
                const text = h2Match[1].trim();
                headings.push({ level: 2, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            } else if (h3Match) {
                const text = h3Match[1].trim();
                headings.push({ level: 3, text, id: text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') });
            }
        });

        return headings;
    }, [selectedArticle]);

    const checklistItems = useMemo(() => {
        if (!selectedArticle?.content) return [];
        const lines = selectedArticle.content.split('\n');
        const items: string[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
                items.push(trimmed.replace(/^-\s*\[[ xX]\]\s*/, ''));
            } else if (/^(步骤\s*[一二三四五六七八九十0-9]+|Langkah\s*\d+|Step\s*\d+)[：:]/i.test(trimmed)) {
                items.push(trimmed);
            } else if (/^\d+\.\s+/.test(trimmed) && trimmed.length > 5 && !trimmed.includes('|')) {
                items.push(trimmed.replace(/^\d+\.\s+/, ''));
            }
        });

        return items;
    }, [selectedArticle]);

    const handleToggleTask = (task: string) => {
        if (!selectedArticle) return;
        const key = `${selectedArticle.id}-${task}`;
        setCheckedTasks(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try {
                localStorage.setItem(`sop_checklist_${selectedArticle.id}`, JSON.stringify(next));
            } catch (e) { }
            return next;
        });
    };

    useEffect(() => {
        if (selectedArticle) {
            try {
                const saved = localStorage.getItem(`sop_checklist_${selectedArticle.id}`);
                if (saved) setCheckedTasks(JSON.parse(saved));
                else setCheckedTasks({});
            } catch (e) { }
        }
    }, [selectedArticle]);

    // ─── Open Copilot Workspace ───────────────────────────────────────────────
    const handleOpenAICopilot = (initialPrompt?: string) => {
        setUndoStack([]);
        setAiAttachedPhoto(null);
        setEditArticle({
            title: '',
            description: '',
            content: '',
            video_url: '',
            page_id: '',
            target_roles: [],
            sort_order: articles.length + 1,
            is_published: true,
            created_by: user?.name || 'Admin',
            category: 'production'
        });
        setChatMessages([
            {
                id: 'welcome',
                sender: 'ai',
                text: '您好！我是 PackSecure SOP 智能副驾驶。您可以直接在下方告诉我您想做什么规程，或点击 📎 拍照上传现场设备/白板图纸，我将直接在右侧为您起草整篇规程，并支持在对话中就地微调。',
                timestamp: new Date()
            }
        ]);
        setEditorTab('split');
        setCopilotOpen(true);
        setIsEditing(true);

        if (initialPrompt) {
            setTimeout(() => handleSendChatMessage(initialPrompt), 200);
        } else {
            setTimeout(() => chatInputRef.current?.focus(), 150);
        }
    };

    const handleEdit = (article: SOPArticle) => {
        setUndoStack([]);
        setAiAttachedPhoto(null);
        setEditArticle({ ...article });
        setChatMessages([
            {
                id: 'welcome-edit',
                sender: 'ai',
                text: `已载入规程《${article.title}》。您可以在下方随时输入修改指令（如“把第2步改一下”、“补充高温安全警告”、“翻译成中马双语”），我将就地在右侧正文中同步修改。`,
                timestamp: new Date()
            }
        ]);
        setEditorTab('split');
        setCopilotOpen(true);
        setIsEditing(true);
        setTimeout(() => chatInputRef.current?.focus(), 150);
    };

    // ─── Photo Selection for AI Copilot ───────────────────────────────────────
    const handleSelectAiPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setAiAttachedPhoto({
                file,
                preview: URL.createObjectURL(file),
                base64
            });
        };
        reader.readAsDataURL(file);
        if (fileInputAiPhotoRef.current) fileInputAiPhotoRef.current.value = '';
    };

    // ─── Send Conversational Chat Instruction ─────────────────────────────────
    const handleSendChatMessage = async (customText?: string) => {
        const text = (customText || chatInput).trim();
        if ((!text && !aiAttachedPhoto) || aiProcessing) return;

        // Push previous article state to Undo Stack
        if (editArticle) {
            setUndoStack(prev => [...prev.slice(-10), { ...editArticle }]);
        }

        const photoSnapshot = aiAttachedPhoto;
        let uploadedPhotoUrl = '';

        // If photo attached, upload it to work-photos in background
        if (photoSnapshot) {
            try {
                const ext = photoSnapshot.file.name.split('.').pop() || 'jpg';
                const fName = `sop_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
                const { error: upErr } = await supabase.storage
                    .from('work-photos')
                    .upload(fName, photoSnapshot.file, { contentType: photoSnapshot.file.type || 'image/jpeg' });
                if (!upErr) {
                    const { data: d } = supabase.storage.from('work-photos').getPublicUrl(fName);
                    uploadedPhotoUrl = d.publicUrl;
                }
            } catch (e) { }
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: text || '请根据我上传的照片起草规范规程',
            timestamp: new Date(),
            photoUrl: photoSnapshot ? photoSnapshot.preview : undefined
        };

        setChatMessages(prev => [...prev, userMsg]);
        if (!customText) setChatInput('');
        setAiAttachedPhoto(null);
        setAiProcessing(true);

        try {
            const resp = await fetch('/api/agent/sop-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat_refine',
                    message: text || '请根据上传的现场设备/工艺照片起草规范规程',
                    topic: text,
                    existingContent: editArticle?.content || '',
                    currentTitle: editArticle?.title || '',
                    language: 'zh',
                    category: editArticle?.category || 'production',
                    targetRoles: editArticle?.target_roles || [],
                    pageId: editArticle?.page_id || '',
                    imageBase64: photoSnapshot?.base64,
                    mimeType: photoSnapshot?.file.type,
                    imageUrl: uploadedPhotoUrl
                })
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(`服务响应异常: ${resp.status}`);
            }

            const json = await resp.json();
            if (!json.success) throw new Error(json.error || 'AI 处理失败');

            const result = json.data;

            // Direct in-place synchronization to right-side editor
            setEditArticle(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    title: (prev.title && prev.title.length > 4 && prev.content && prev.content.length > 50) ? prev.title : (result.title || prev.title),
                    description: result.description || prev.description,
                    content: result.content || prev.content,
                    target_roles: prev.target_roles?.length ? prev.target_roles : (result.suggested_roles || prev.target_roles),
                    page_id: prev.page_id ? prev.page_id : (result.suggested_page_id || prev.page_id),
                    category: result.category || prev.category
                };
            });

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: result.summary || '已为您同步更新右侧工作台规程正文。',
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: `⚠️ 处理出现异常: ${err.message}，请重新发送指令。`,
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setAiProcessing(false);
            setTimeout(() => {
                chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    };

    // ─── Upload Image Directly into Markdown Text ─────────────────────────────
    const handleUploadMarkdownImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `sop_img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            const { error } = await supabase.storage
                .from('work-photos')
                .upload(fileName, file, { contentType: file.type || 'image/jpeg' });

            if (error) throw error;
            const { data } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;

            // Insert into markdown text
            const imgSnippet = `\n\n![${file.name.replace(/\.[^/.]+$/, '')}](${publicUrl})\n\n`;
            setEditArticle(prev => prev ? { ...prev, content: (prev.content || '') + imgSnippet } : prev);
        } catch (err: any) {
            alert('插图上传失败: ' + err.message);
        } finally {
            setUploadingImage(false);
            if (fileInputImageRef.current) fileInputImageRef.current.value = '';
        }
    };

    // ─── Upload Local Video for SOP Article ───────────────────────────────────
    const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 100 * 1024 * 1024) {
            alert('视频文件较大，请上传小于 100MB 的视频。');
            return;
        }

        setUploadingVideo(true);
        try {
            const ext = file.name.split('.').pop() || 'mp4';
            const fileName = `sop_vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            const { error } = await supabase.storage
                .from('work-photos')
                .upload(fileName, file, { contentType: file.type || 'video/mp4' });

            if (error) throw error;
            const { data } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;

            setEditArticle(prev => prev ? { ...prev, video_url: publicUrl } : prev);
        } catch (err: any) {
            alert('视频上传失败: ' + err.message);
        } finally {
            setUploadingVideo(false);
            if (fileInputVideoRef.current) fileInputVideoRef.current.value = '';
        }
    };

    // Undo last modification
    const handleUndo = () => {
        if (undoStack.length === 0) return;
        const lastState = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setEditArticle(prev => prev ? { ...prev, ...lastState } : prev);
        setChatMessages(prev => [
            ...prev,
            {
                id: Date.now().toString(),
                sender: 'ai',
                text: '↩️ 已为您撤销上一次改动，右侧工作台已恢复至修改前的状态。',
                timestamp: new Date()
            }
        ]);
        setTimeout(() => {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // Quick insert snippets
    const insertSnippet = (snippet: string) => {
        setEditArticle(prev => prev ? { ...prev, content: (prev.content || '') + '\n\n' + snippet } : prev);
    };

    // ─── Save SOP to Supabase ─────────────────────────────────────────────────
    const handleSave = async () => {
        if (!editArticle?.title) {
            alert(t('请输入规程标题'));
            return;
        }

        try {
            if (editArticle.id) {
                const { error } = await supabase
                    .from('sop_articles')
                    .update({
                        title: editArticle.title,
                        description: editArticle.description || '',
                        content: editArticle.content || '',
                        video_url: editArticle.video_url || '',
                        page_id: editArticle.page_id || '',
                        target_roles: editArticle.target_roles || [],
                        sort_order: editArticle.sort_order || 0,
                        is_published: editArticle.is_published ?? true,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editArticle.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sop_articles')
                    .insert({
                        title: editArticle.title,
                        description: editArticle.description || '',
                        content: editArticle.content || '',
                        video_url: editArticle.video_url || '',
                        page_id: editArticle.page_id || '',
                        target_roles: editArticle.target_roles || [],
                        sort_order: editArticle.sort_order || 0,
                        is_published: editArticle.is_published ?? true,
                        created_by: editArticle.created_by || user?.name || 'Admin',
                    });

                if (error) throw error;
            }

            setIsEditing(false);
            setEditArticle(null);
            loadArticles();
        } catch (err: any) {
            alert(t('保存失败: ') + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('确定删除该规程吗？此操作无法撤销。'))) return;
        await supabase.from('sop_articles').delete().eq('id', id);
        loadArticles();
        if (selectedArticle?.id === id) setSelectedArticle(null);
    };

    const renderVideoPlayer = (url: string) => {
        if (!url) return null;
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (ytMatch) {
            return (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-indigo-500/20 shadow-xl bg-black my-6">
                    <iframe
                        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                        title="SOP Video"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            );
        }
        return (
            <div className="my-6 rounded-2xl overflow-hidden border border-gray-800 bg-black shadow-xl">
                <video controls className="w-full aspect-video rounded-2xl">
                    <source src={url} />
                    {t('浏览器不支持播放此格式视频')}
                </video>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. ARTICLE DETAIL VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    if (selectedArticle) {
        const associatedPage = SYSTEM_PAGES.find(p => p.id === selectedArticle.page_id);
        const checkedCount = checklistItems.filter(item => checkedTasks[`${selectedArticle.id}-${item}`]).length;
        const progressPct = checklistItems.length > 0 ? Math.round((checkedCount / checklistItems.length) * 100) : 0;

        return (
            <div className="h-full flex flex-col overflow-hidden bg-gray-950">
                {/* Print Header */}
                <div className="hidden print:block p-8 border-b-2 border-black text-black">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">PACKSECURE OS</h1>
                            <p className="text-xs uppercase tracking-widest text-gray-600 font-mono mt-1">车间标准作业规程 (Standard Operating Procedure)</p>
                        </div>
                        <div className="text-right text-xs font-mono">
                            <p>DOC ID: {selectedArticle.id.slice(0, 8).toUpperCase()}</p>
                            <p>UPDATE: {new Date(selectedArticle.updated_at || Date.now()).toLocaleDateString()}</p>
                            <p>ROLES: {selectedArticle.target_roles.join(', ') || 'ALL'}</p>
                        </div>
                    </div>
                </div>

                {/* Top Navbar */}
                <div className="print:hidden flex-shrink-0 px-6 py-4 border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-xl flex items-center justify-between z-10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedArticle(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition-all font-bold text-xs shadow-sm hover:scale-105 active:scale-95"
                        >
                            <ChevronLeft size={16} />
                            {t('返回规程列表')}
                        </button>

                        <div className="h-4 w-px bg-gray-800" />

                        {/* Checklist Mode Toggle */}
                        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
                            <button
                                onClick={() => setIsChecklistMode(false)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${!isChecklistMode ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            >
                                <BookOpen size={14} />
                                {t('完整阅读')}
                            </button>
                            <button
                                onClick={() => setIsChecklistMode(true)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${isChecklistMode ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            >
                                <CheckSquare size={14} />
                                {t('实操核对模式')}
                                {checklistItems.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-900/60 text-[10px]">
                                        {checkedCount}/{checklistItems.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {selectedArticle.page_id && onNavigate && (
                            <button
                                onClick={() => onNavigate(selectedArticle.page_id!)}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                <ExternalLink size={14} />
                                <span>{t('前往关联功能')}</span>
                                {associatedPage && <span className="opacity-80 text-[11px]">({associatedPage.name.split(' ')[0]})</span>}
                            </button>
                        )}

                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-bold transition-all hover:scale-105 active:scale-95"
                            title="打印 A4 车间标准作业表"
                        >
                            <Printer size={14} />
                            <span>{t('打印规范')}</span>
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => handleEdit(selectedArticle)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all hover:scale-105"
                            >
                                <Pencil size={14} />
                                <span>{t('编辑')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Article Header Banner */}
                <div className="flex-shrink-0 px-8 py-6 bg-gradient-to-b from-indigo-950/30 to-transparent border-b border-gray-800/40">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {CATEGORIES.find(c => c.id === selectedArticle.category)?.label || '综合规范'}
                            </span>
                            {selectedArticle.target_roles.map(r => (
                                <span
                                    key={r}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                    style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '22', color: ROLE_COLORS[r] || '#666', border: `1px solid ${(ROLE_COLORS[r] || '#666')}44` }}
                                >
                                    {r}
                                </span>
                            ))}
                            {selectedArticle.page_id && (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-gray-800 text-gray-400 border border-gray-700">
                                    Page: {selectedArticle.page_id}
                                </span>
                            )}
                        </div>

                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                            {selectedArticle.title}
                        </h1>
                        {selectedArticle.description && (
                            <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                                {selectedArticle.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Article Main Body with TOC */}
                <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-9 space-y-6">
                            {selectedArticle.video_url && renderVideoPlayer(selectedArticle.video_url)}

                            {isChecklistMode ? (
                                <div className="space-y-6">
                                    <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/50 to-blue-950/30 border border-indigo-500/30 shadow-xl">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                                                    <CheckSquare size={18} className="text-indigo-400" />
                                                    {t('车间作业实操核对清单')}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-0.5">{t('在现场操作时，请逐项确认并打勾核验，确保安全无疏漏。')}</p>
                                            </div>
                                            <div className="text-right font-black text-2xl text-indigo-400">
                                                {progressPct}%
                                            </div>
                                        </div>

                                        <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 rounded-full"
                                                style={{ width: `${progressPct}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
                                            <span>已完成: {checkedCount} 项</span>
                                            <span>总共: {checklistItems.length} 项</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {checklistItems.map((task, idx) => {
                                            const isDone = !!checkedTasks[`${selectedArticle.id}-${task}`];
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleToggleTask(task)}
                                                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${isDone
                                                        ? 'bg-indigo-950/20 border-indigo-500/40 text-gray-300'
                                                        : 'bg-gray-900/60 border-gray-800/80 text-white hover:border-gray-700 hover:bg-gray-900'
                                                        }`}
                                                >
                                                    <div className="mt-0.5 text-indigo-400 shrink-0">
                                                        {isDone ? (
                                                            <CheckSquare size={20} className="text-indigo-400 fill-indigo-500/20" />
                                                        ) : (
                                                            <Square size={20} className="text-gray-500 group-hover:text-gray-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-sm font-medium leading-relaxed">
                                                        <span className={`transition-all ${isDone ? 'line-through text-gray-500' : ''}`}>
                                                            {task}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={() => {
                                                if (confirm(t('确定重置所有勾选状态吗？'))) {
                                                    setCheckedTasks({});
                                                    localStorage.removeItem(`sop_checklist_${selectedArticle.id}`);
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-400 hover:text-white"
                                        >
                                            <RotateCcw size={13} />
                                            {t('重置所有勾选')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="prose prose-invert max-w-none prose-indigo">
                                    <ReactMarkdown components={MarkdownComponents}>
                                        {selectedArticle.content}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {/* Sign-off Box (Visible on Print) */}
                            <div className="hidden print:block pt-12 mt-12 border-t-2 border-black text-black">
                                <div className="grid grid-cols-3 gap-8 text-xs font-bold">
                                    <div className="border-t border-black pt-2">
                                        <p>操作人 / 工号 (Operator):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">签字确认 (Signature)</p>
                                    </div>
                                    <div className="border-t border-black pt-2">
                                        <p>班组长 / 主管 (Supervisor):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">核验确认 (Approved)</p>
                                    </div>
                                    <div className="border-t border-black pt-2">
                                        <p>执行日期 (Date):</p>
                                        <div className="h-10"></div>
                                        <p className="text-[10px] text-gray-500">YYYY / MM / DD</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TOC Sidebar */}
                        <div className="hidden lg:block lg:col-span-3 sticky top-6 space-y-4 print:hidden">
                            {tableOfContents.length > 0 && (
                                <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800/80 backdrop-blur-md shadow-lg">
                                    <h4 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-3 flex items-center gap-1.5">
                                        <List size={14} className="text-indigo-400" />
                                        {t('章节大纲目录')}
                                    </h4>
                                    <nav className="space-y-1.5 text-xs max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {tableOfContents.map((h, i) => (
                                            <a
                                                key={i}
                                                href={`#${h.id}`}
                                                className={`block truncate transition-colors hover:text-white ${h.level === 1
                                                    ? 'font-bold text-gray-200'
                                                    : h.level === 2
                                                        ? 'pl-3 text-gray-400 hover:text-indigo-300'
                                                        : 'pl-6 text-gray-500 hover:text-indigo-300'
                                                    }`}
                                            >
                                                {h.text}
                                            </a>
                                        ))}
                                    </nav>
                                </div>
                            )}

                            <div className="p-4 rounded-2xl bg-gray-900/40 border border-gray-800/60 text-xs space-y-2.5">
                                <div className="flex justify-between text-gray-400">
                                    <span>创建者:</span>
                                    <span className="font-bold text-gray-300">{selectedArticle.created_by || '系统'}</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>更新时间:</span>
                                    <span className="font-bold text-gray-300">
                                        {selectedArticle.updated_at ? new Date(selectedArticle.updated_at).toLocaleDateString() : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>步骤项:</span>
                                    <span className="font-bold text-indigo-400">{checklistItems.length} 项标准操作</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. MAIN LIST VIEW
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col overflow-hidden bg-gray-950 text-white">

            {/* Top Header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <BookOpen size={22} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black tracking-tight text-white">{t('SOP Guide Center')}</h1>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-extrabold uppercase">
                                    Copilot 2.0
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('标准作业规程与岗位操作门户 • 汇聚车间、物流、人事全流程')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Executive AI Assistant Trigger: Direct Workspace launch! */}
                        {isAdmin && (
                            <button
                                onClick={() => handleOpenAICopilot()}
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <Bot size={16} className="text-amber-300 animate-pulse" />
                                <span>{t('🤖 AI 智能起草 SOP')}</span>
                            </button>
                        )}

                        {isAdmin && (
                            <button
                                onClick={() => handleOpenAICopilot()}
                                className="px-3.5 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>{t('新建 SOP')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('规程总数')}</p>
                            <p className="text-lg font-black text-white">{stats.total}</p>
                        </div>
                        <BookOpen size={18} className="text-indigo-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('已发布执行')}</p>
                            <p className="text-lg font-black text-emerald-400">{stats.published}</p>
                        </div>
                        <CheckCircle2 size={18} className="text-emerald-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('我的工种适用')}</p>
                            <p className="text-lg font-black text-amber-400">{stats.forMyRole}</p>
                        </div>
                        <Users size={18} className="text-amber-400 opacity-60" />
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-500">{t('绑定系统页面')}</p>
                            <p className="text-lg font-black text-blue-400">{stats.withPages}</p>
                        </div>
                        <ExternalLink size={18} className="text-blue-400 opacity-60" />
                    </div>
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2 mb-3">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20 scale-105'
                                    : 'bg-gray-900/70 text-gray-400 border-gray-800/80 hover:text-gray-200 hover:border-gray-700'
                                    }`}
                            >
                                <Icon size={14} className={isSelected ? 'text-white' : cat.color} />
                                <span>{t(cat.label)}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Bar & Role Filter */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('搜索规范名称、核心步骤、设备机台或 Page ID...')}
                            className="w-full bg-gray-900/90 border border-gray-800 rounded-xl pl-10 pr-10 py-2 text-white text-xs placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 shrink-0">
                        <button
                            onClick={() => setRoleFilter('All')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${roleFilter === 'All' ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            {t('全部角色')}
                        </button>
                        {ALL_ROLES.map(role => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${roleFilter === role ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                style={{ color: roleFilter === role ? ROLE_COLORS[role] : undefined }}
                            >
                                {role}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}
                            title="网格卡片视图"
                        >
                            <LayoutGrid size={15} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-white'}`}
                            title="列表紧凑视图"
                        >
                            <List size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Articles List Display */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        <span className="text-xs font-medium">{t('正在加载 SOP 规范库...')}</span>
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
                        <FileText size={48} className="opacity-20 text-indigo-400" />
                        <p className="font-bold text-sm text-gray-400">{t('未找到匹配的标准作业规程')}</p>
                        <p className="text-xs text-gray-600">{t('尝试切换分类筛选，或使用 AI 智能副驾驶一句话起草新规程')}</p>
                        {isAdmin && (
                            <button
                                onClick={() => handleOpenAICopilot()}
                                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                            >
                                <Bot size={14} />
                                {t('立即由 AI 起草一份')}
                            </button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredArticles.map(article => {
                            const catObj = CATEGORIES.find(c => c.id === article.category);
                            const CatIcon = catObj?.icon || BookOpen;
                            const hasVideo = !!article.video_url;
                            const hasPage = !!article.page_id;

                            return (
                                <div
                                    key={article.id}
                                    onClick={() => setSelectedArticle(article)}
                                    className="group relative bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer flex flex-col"
                                >
                                    <div className="relative h-32 overflow-hidden bg-gradient-to-br from-indigo-950/80 via-gray-900 to-purple-950/40 p-4 flex flex-col justify-between">
                                        <div className="flex items-center justify-between z-10">
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/40 backdrop-blur-md border border-white/10 text-gray-300">
                                                <CatIcon size={12} className={catObj?.color} />
                                                {catObj?.label || '规范'}
                                            </span>

                                            {!article.is_published && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                                                    {t('草稿')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="absolute right-4 bottom-2 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
                                            <CatIcon size={80} className="text-white" />
                                        </div>

                                        <div className="flex items-center gap-1.5 z-10">
                                            {hasVideo && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold">
                                                    <Play size={10} /> 视频教学
                                                </span>
                                            )}
                                            {hasPage && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold font-mono">
                                                    <ExternalLink size={10} /> {article.page_id}
                                                </span>
                                            )}
                                        </div>

                                        {isAdmin && (
                                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEdit(article); }}
                                                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-blue-600 transition-colors"
                                                    title="编辑 SOP"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                                    className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-red-600 transition-colors"
                                                    title="删除 SOP"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div>
                                            <h3 className="text-white font-extrabold text-sm mb-1.5 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                                                {article.title}
                                            </h3>
                                            <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
                                                {article.description || article.content.slice(0, 100)}
                                            </p>
                                        </div>

                                        <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between">
                                            <div className="flex flex-wrap gap-1">
                                                {article.target_roles.length === 0 ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-gray-800/80 text-gray-400 text-[10px] font-bold">
                                                        {t('全员适用')}
                                                    </span>
                                                ) : (
                                                    article.target_roles.slice(0, 3).map(r => (
                                                        <span
                                                            key={r}
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                            style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '20', color: ROLE_COLORS[r] || '#666' }}
                                                        >
                                                            {r}
                                                        </span>
                                                    ))
                                                )}
                                                {article.target_roles.length > 3 && (
                                                    <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 text-[9px] font-bold">
                                                        +{article.target_roles.length - 3}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-[10px] text-gray-500 font-mono">
                                                {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl overflow-hidden divide-y divide-gray-800/60">
                        {filteredArticles.map(article => {
                            const catObj = CATEGORIES.find(c => c.id === article.category);
                            const CatIcon = catObj?.icon || BookOpen;

                            return (
                                <div
                                    key={article.id}
                                    onClick={() => setSelectedArticle(article)}
                                    className="p-4 flex items-center justify-between hover:bg-gray-900/80 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                                        <div className="w-9 h-9 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 transition-transform">
                                            <CatIcon size={16} className={catObj?.color} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 truncate transition-colors">
                                                    {article.title}
                                                </h4>
                                                {!article.is_published && (
                                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                        草稿
                                                    </span>
                                                )}
                                                {article.page_id && (
                                                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                                                        Page: {article.page_id}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                {article.description || article.content.slice(0, 80)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex gap-1">
                                            {article.target_roles.map(r => (
                                                <span
                                                    key={r}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                    style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '20', color: ROLE_COLORS[r] || '#666' }}
                                                >
                                                    {r}
                                                </span>
                                            ))}
                                        </div>

                                        {isAdmin && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEdit(article); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}

                                        <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
                3. ALL-IN-ONE NOTION-STYLE COPILOT WORKSPACE
            ═══════════════════════════════════════════════════════════════════════ */}
            {isEditing && editArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-2 sm:p-5 animate-in fade-in duration-200">
                    <div className="bg-gray-950 border border-gray-800 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Workspace Top Header Bar */}
                        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setCopilotOpen(!copilotOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${copilotOpen
                                        ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                                        }`}
                                    title={copilotOpen ? "折叠 AI 对话栏" : "展开 AI 对话栏"}
                                >
                                    <Bot size={15} className="text-amber-300" />
                                    <span>AI 副驾驶</span>
                                    {copilotOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                                </button>

                                <div className="h-4 w-px bg-gray-800" />

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-white">
                                        {editArticle.id ? t('编辑 SOP 工作台') : t('AI 协助创作工作台')}
                                    </span>
                                    {editArticle.title && (
                                        <span className="text-xs text-gray-400 truncate max-w-xs font-medium">
                                            • {editArticle.title}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Editor View Modes */}
                                <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1">
                                    <button
                                        onClick={() => setEditorTab('write')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'write' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('纯编辑')}
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('split')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'split' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('分屏对比')}
                                    </button>
                                    <button
                                        onClick={() => setEditorTab('preview')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${editorTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t('最终预览')}
                                    </button>
                                </div>

                                <button
                                    onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                    className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Workspace Middle Content: Left (Copilot Chat) + Right (Editor Canvas) */}
                        <div className="flex-1 flex overflow-hidden">

                            {/* ── LEFT: Conversational AI Copilot Panel ── */}
                            {copilotOpen && (
                                <div className="w-full sm:w-96 border-r border-gray-800 bg-gray-900/30 flex flex-col shrink-0">
                                    {/* Chat Header */}
                                    <div className="p-3.5 border-b border-gray-800/80 bg-gray-900/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                                                <Bot size={15} className="text-amber-300" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-extrabold text-white">SOP 智能副驾驶</h3>
                                                <p className="text-[10px] text-gray-400">输入一句话或传图，边聊边改</p>
                                            </div>
                                        </div>

                                        {undoStack.length > 0 && (
                                            <button
                                                onClick={handleUndo}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300 text-[11px] font-bold transition"
                                                title="撤销上一次 AI 修改"
                                            >
                                                <Undo2 size={12} />
                                                <span>撤销</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Chat Message History */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs">
                                        {chatMessages.map(msg => (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[90%] p-3 rounded-2xl leading-relaxed space-y-2 ${msg.sender === 'user'
                                                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                                                        : 'bg-gray-800/80 border border-gray-700/60 text-gray-200 rounded-bl-none shadow'
                                                        }`}
                                                >
                                                    {msg.photoUrl && (
                                                        <div className="rounded-xl overflow-hidden border border-white/20 max-h-40">
                                                            <img src={msg.photoUrl} alt="Attached" className="w-full h-auto object-cover" />
                                                        </div>
                                                    )}
                                                    <p>{msg.text}</p>
                                                </div>
                                                <span className="text-[9px] text-gray-600 mt-1 px-1">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ))}

                                        {aiProcessing && (
                                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs animate-pulse">
                                                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                <span>AI 正在分析并就地修改右侧规程...</span>
                                            </div>
                                        )}
                                        <div ref={chatBottomRef} />
                                    </div>

                                    {/* Starter Suggestion Pills (Shown if only welcome message) */}
                                    {chatMessages.length <= 1 && (
                                        <div className="p-3 border-t border-gray-800/60 space-y-1.5 bg-gray-950/40">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">💡 快速开始灵感:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    '🚚 我想做司机的sop',
                                                    '⚙️ 拉伸膜机T1.1换卷规程',
                                                    '🫧 气泡膜机开机排气规范',
                                                    '🛡️ 车间PPE防护守则'
                                                ].map(pill => (
                                                    <button
                                                        key={pill}
                                                        onClick={() => handleSendChatMessage(pill.slice(3))}
                                                        className="px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-[11px] font-medium transition"
                                                    >
                                                        {pill}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Action Chips Bar */}
                                    {editArticle.content && editArticle.content.length > 20 && (
                                        <div className="px-3 py-2 border-t border-gray-800/60 flex flex-wrap gap-1.5 bg-gray-950/60">
                                            <button
                                                onClick={() => handleSendChatMessage('请精简当前规程正文，去除冗余套话，保留最干练的核心步骤')}
                                                disabled={aiProcessing}
                                                className="px-2 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-indigo-300 text-[10px] font-bold transition disabled:opacity-50"
                                            >
                                                ⚡ 精简步骤
                                            </button>
                                            <button
                                                onClick={() => handleSendChatMessage('请审查当前规程中的安全隐患，在步骤前增加 [!WARNING] 或 [!CAUTION] 彩色安全警告卡片')}
                                                disabled={aiProcessing}
                                                className="px-2 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 text-[10px] font-bold transition disabled:opacity-50"
                                            >
                                                ⚠️ 加安全警告
                                            </button>
                                            <button
                                                onClick={() => handleSendChatMessage('请将当前规程的标题和各步骤转换为中文 + 马来文 (Bahasa Melayu) 双语对照版本')}
                                                disabled={aiProcessing}
                                                className="px-2 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-emerald-300 text-[10px] font-bold transition disabled:opacity-50"
                                            >
                                                🌐 转中马双语
                                            </button>
                                            <button
                                                onClick={() => handleSendChatMessage('请从当前正文中提取出一线员工可闭环打勾的实操核对清单（- [ ] 格式）')}
                                                disabled={aiProcessing}
                                                className="px-2 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-purple-300 text-[10px] font-bold transition disabled:opacity-50"
                                            >
                                                📋 提取清单
                                            </button>
                                        </div>
                                    )}

                                    {/* Photo Preview Strip (if photo attached) */}
                                    {aiAttachedPhoto && (
                                        <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/80 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <img src={aiAttachedPhoto.preview} alt="Attached" className="w-8 h-8 rounded-lg object-cover border border-indigo-500/40" />
                                                <div className="text-[11px] truncate max-w-[180px] text-gray-300 font-mono">
                                                    {aiAttachedPhoto.file.name}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setAiAttachedPhoto(null)}
                                                className="text-gray-500 hover:text-red-400 p-1 rounded-lg"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {/* Chat Input Bar */}
                                    <div className="p-3 border-t border-gray-800 bg-gray-950">
                                        <form
                                            onSubmit={e => {
                                                e.preventDefault();
                                                handleSendChatMessage();
                                            }}
                                            className="flex items-center gap-2"
                                        >
                                            <input
                                                ref={fileInputAiPhotoRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleSelectAiPhoto}
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputAiPhotoRef.current?.click()}
                                                className="p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition"
                                                title="拍照或上传车间现场/机台照片"
                                            >
                                                <Camera size={15} />
                                            </button>

                                            <input
                                                ref={chatInputRef}
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                placeholder={t('对 AI 说，如：把第2步改成必须拍两张照...')}
                                                disabled={aiProcessing}
                                                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition disabled:opacity-50"
                                            />
                                            <button
                                                type="submit"
                                                disabled={aiProcessing || (!chatInput.trim() && !aiAttachedPhoto)}
                                                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 shadow-md shadow-indigo-600/20"
                                            >
                                                <Send size={15} />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* ── RIGHT: SOP Editor Canvas ── */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">

                                {/* Editor Metadata Configuration Ribbon */}
                                <div className="p-5 border-b border-gray-800/80 bg-gray-900/30 space-y-3.5 shrink-0 overflow-y-auto max-h-60 custom-scrollbar">
                                    {/* Title & Category */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">
                                                {t('规程标题 (Title) *')}
                                            </label>
                                            <input
                                                value={editArticle.title || ''}
                                                onChange={e => setEditArticle(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                                placeholder={t('例如：司机配送与回厂交单扫码还车规范')}
                                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-white text-sm font-bold focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">
                                                {t('分类 (Category)')}
                                            </label>
                                            <select
                                                value={editArticle.category || 'production'}
                                                onChange={e => setEditArticle(prev => prev ? { ...prev, category: e.target.value } : prev)}
                                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
                                            >
                                                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                                    <option key={c.id} value={c.id}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Roles, System Page & Status */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                        {/* Roles */}
                                        <div className="md:col-span-5">
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">
                                                {t('适用工种角色')}
                                            </label>
                                            <div className="flex flex-wrap gap-1">
                                                {ALL_ROLES.map(role => {
                                                    const isSelected = editArticle.target_roles?.includes(role);
                                                    return (
                                                        <button
                                                            key={role}
                                                            type="button"
                                                            onClick={() => {
                                                                setEditArticle(prev => {
                                                                    if (!prev) return prev;
                                                                    const cur = prev.target_roles || [];
                                                                    return {
                                                                        ...prev,
                                                                        target_roles: isSelected
                                                                            ? cur.filter(r => r !== role)
                                                                            : [...cur, role]
                                                                    };
                                                                });
                                                            }}
                                                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition border ${isSelected
                                                                ? 'border-white/40 shadow-sm'
                                                                : 'border-gray-800 opacity-60 hover:opacity-100'
                                                                }`}
                                                            style={{
                                                                backgroundColor: isSelected ? (ROLE_COLORS[role] || '#666') + '25' : 'transparent',
                                                                color: ROLE_COLORS[role] || '#666'
                                                            }}
                                                        >
                                                            {role}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Associated System Page */}
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">
                                                {t('关联系统功能 (一键跳转)')}
                                            </label>
                                            <select
                                                value={editArticle.page_id || ''}
                                                onChange={e => setEditArticle(prev => prev ? { ...prev, page_id: e.target.value } : prev)}
                                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 outline-none"
                                            >
                                                <option value="">{t('无关联功能 (纯指导文档)')}</option>
                                                {SYSTEM_PAGES.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        [{p.id}] {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Publish Status Toggle */}
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">
                                                {t('发布状态')}
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setEditArticle(prev => prev ? { ...prev, is_published: !prev.is_published } : prev)}
                                                className={`w-full py-1.5 rounded-xl font-bold text-xs transition border flex items-center justify-center gap-1.5 ${editArticle.is_published
                                                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                                                    : 'bg-gray-900 border-gray-800 text-gray-500'
                                                    }`}
                                            >
                                                {editArticle.is_published ? (
                                                    <>
                                                        <CheckCircle2 size={13} />
                                                        <span>{t('已发布 (执行中)')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle size={13} />
                                                        <span>{t('草稿 (内部编制)')}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Video Tutorial Upload & Link Ribbon Row */}
                                    <div className="pt-2 border-t border-gray-800/60">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Film size={14} className="text-red-400 shrink-0" />
                                                <span className="text-[10px] font-black uppercase text-gray-400">
                                                    {t('配套教学视频 (Video Tutorial)')}
                                                </span>
                                                {editArticle.video_url && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono truncate max-w-xs">
                                                        已配置视频
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <input
                                                    ref={fileInputVideoRef}
                                                    type="file"
                                                    accept="video/mp4,video/webm,video/quicktime"
                                                    onChange={handleUploadVideo}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputVideoRef.current?.click()}
                                                    disabled={uploadingVideo}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700 hover:border-gray-600 text-gray-200 text-xs font-bold transition hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
                                                >
                                                    {uploadingVideo ? (
                                                        <>
                                                            <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                            <span>视频上传中...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={12} className="text-red-400" />
                                                            <span>上传本地视频 (MP4/WebM)</span>
                                                        </>
                                                    )}
                                                </button>

                                                <div className="relative flex-1 sm:w-72">
                                                    <input
                                                        value={editArticle.video_url || ''}
                                                        onChange={e => setEditArticle(prev => prev ? { ...prev, video_url: e.target.value } : prev)}
                                                        placeholder="或粘贴 YouTube / MP4 链接..."
                                                        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 outline-none font-mono"
                                                    />
                                                    {editArticle.video_url && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditArticle(prev => prev ? { ...prev, video_url: '' } : prev)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                                            title="移除视频"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Markdown Editor Toolbar & Canvas */}
                                <div className="flex-1 overflow-hidden p-5 flex flex-col space-y-2">
                                    {/* In-Editor Media & Markdown Toolbar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                ref={fileInputImageRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleUploadMarkdownImage}
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputImageRef.current?.click()}
                                                disabled={uploadingImage}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700 hover:border-gray-600 text-indigo-300 hover:text-white text-xs font-bold transition hover:scale-105 active:scale-95 disabled:opacity-50"
                                            >
                                                {uploadingImage ? (
                                                    <>
                                                        <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                                        <span>插图上传中...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ImageIcon size={14} className="text-indigo-400" />
                                                        <span>插入车间插图/照片</span>
                                                    </>
                                                )}
                                            </button>

                                            <div className="h-4 w-px bg-gray-800 mx-1" />

                                            <button
                                                type="button"
                                                onClick={() => insertSnippet('> [!WARNING]\n> 注意事项：严禁触碰运转辊轮与高温模具！')}
                                                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-amber-400 text-[11px] font-bold"
                                            >
                                                + ⚠️ 警告卡片
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => insertSnippet('> [!TIP]\n> 操作技巧：引料时保持双手位于安全挡板以外。')}
                                                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-emerald-400 text-[11px] font-bold"
                                            >
                                                + 💡 技巧卡片
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => insertSnippet('| 检验项目 | 标准值 | 允许公差 |\n| :--- | :--- | :--- |\n| 膜厚度 | 20 μm | ± 1 μm |\n| 卷宽度 | 500 mm | ± 2 mm |')}
                                                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-blue-400 text-[11px] font-bold"
                                            >
                                                + 📊 对比表格
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => insertSnippet('- [ ] 开机前设备与防护自检\n- [ ] 扫码确认上岗\n- [ ] 首件公差检验确认')}
                                                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-purple-400 text-[11px] font-bold"
                                            >
                                                + 📋 核对清单
                                            </button>
                                        </div>

                                        <div className="text-[11px] text-gray-500 font-mono">
                                            Markdown 格式支持
                                        </div>
                                    </div>

                                    {/* Markdown Canvas & Split Screen */}
                                    <div className={`flex-1 grid gap-4 overflow-hidden ${editorTab === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                        {/* Write Textarea */}
                                        {editorTab !== 'preview' && (
                                            <div className="h-full flex flex-col">
                                                <textarea
                                                    value={editArticle.content || ''}
                                                    onChange={e => setEditArticle(prev => prev ? { ...prev, content: e.target.value } : prev)}
                                                    placeholder={t('# 规程标题\n\n> [!NOTE]\n> 规程目的与背景\n\n## 1. 核心操作步骤\n1. 步骤一\n2. 步骤二\n\n> [!WARNING]\n> 安全注意事项')}
                                                    className="w-full flex-1 bg-gray-900/90 border border-gray-800 rounded-2xl p-4 text-white font-mono text-xs focus:border-indigo-500 outline-none resize-none leading-relaxed custom-scrollbar shadow-inner"
                                                />
                                            </div>
                                        )}

                                        {/* Real-time Markdown Preview */}
                                        {editorTab !== 'write' && (
                                            <div className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-5 overflow-y-auto custom-scrollbar prose prose-invert prose-indigo text-xs">
                                                {editArticle.video_url && (
                                                    <div className="mb-4">
                                                        {renderVideoPlayer(editArticle.video_url)}
                                                    </div>
                                                )}

                                                {editArticle.content ? (
                                                    <ReactMarkdown components={MarkdownComponents}>
                                                        {editArticle.content}
                                                    </ReactMarkdown>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                                                        <Bot size={36} className="opacity-30 text-indigo-400" />
                                                        <p className="font-medium text-xs">在左侧 AI 对话框输入一句话或传图</p>
                                                        <p className="text-[11px] text-gray-500">AI 将自动在此处为您实时生成并渲染规程正文与插图</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Editor Footer Actions */}
                                <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-800 bg-gray-950 shrink-0">
                                    <div className="text-xs text-gray-500 font-mono">
                                        {editArticle.content ? `${editArticle.content.length} 字符` : '草稿'}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                            className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white font-bold text-xs transition"
                                        >
                                            {t('取消')}
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Save size={15} />
                                            {t('保存规程')}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
