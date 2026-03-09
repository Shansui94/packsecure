import { useState, useEffect, useRef } from 'react';
import {
    BookOpen, Plus, Pencil, Trash2, X, Upload,
    ChevronLeft, Play, FileText, Search, Save
} from 'lucide-react';
import { supabase } from '../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SOPArticle {
    id: string;
    title: string;
    description: string;
    content: string;
    video_url: string;
    page_id: string;
    target_roles: string[];
    sort_order: number;
    is_published: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
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

// ─── Main Component ───────────────────────────────────────────────────────────
const SOPCenter = ({ userRole, user }: { userRole?: string; user?: any }) => {
    const [articles, setArticles] = useState<SOPArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<SOPArticle | null>(null);

    // Admin state
    const [isEditing, setIsEditing] = useState(false);
    const [editArticle, setEditArticle] = useState<Partial<SOPArticle> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const isAdmin = userRole === 'SuperAdmin' || userRole === 'Admin' || user?.employeeId === '001';

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sop_articles')
            .select('*')
            .order('sort_order', { ascending: true });

        if (!error && data) {
            setArticles(data);
        }
        setLoading(false);
    };

    // Filter articles for current user's role
    const visibleArticles = articles.filter(a => {
        if (isAdmin) return true; // Admin sees all
        if (!a.is_published) return false;
        if (a.target_roles.length === 0) return true; // No role restriction
        return userRole && a.target_roles.includes(userRole);
    });

    const filteredArticles = visibleArticles.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ─── CRUD Operations ──────────────────────────────────────────────────────
    const handleCreate = () => {
        setEditArticle({
            title: '',
            description: '',
            content: '',
            video_url: '',
            page_id: '',
            target_roles: [],
            sort_order: articles.length,
            is_published: true,
            created_by: user?.name || '',
        });
        setIsEditing(true);
    };

    const handleEdit = (article: SOPArticle) => {
        setEditArticle({ ...article });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editArticle?.title) return;

        if (editArticle.id) {
            // Update
            const { error } = await supabase
                .from('sop_articles')
                .update({
                    title: editArticle.title,
                    description: editArticle.description,
                    content: editArticle.content,
                    video_url: editArticle.video_url,
                    page_id: editArticle.page_id,
                    target_roles: editArticle.target_roles,
                    sort_order: editArticle.sort_order,
                    is_published: editArticle.is_published,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', editArticle.id);
            if (error) { alert('保存失败: ' + error.message); return; }
        } else {
            // Insert
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
                    created_by: editArticle.created_by || '',
                });
            if (error) { alert('创建失败: ' + error.message); return; }
        }

        setIsEditing(false);
        setEditArticle(null);
        loadArticles();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这篇 SOP 吗？')) return;
        await supabase.from('sop_articles').delete().eq('id', id);
        loadArticles();
        if (selectedArticle?.id === id) setSelectedArticle(null);
    };

    const handleVideoUpload = async (file: File) => {
        setUploading(true);
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
            .from('sop-videos')
            .upload(fileName, file);

        if (error) {
            alert('上传失败: ' + error.message);
            setUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage
            .from('sop-videos')
            .getPublicUrl(data.path);

        setEditArticle(prev => prev ? { ...prev, video_url: urlData.publicUrl } : prev);
        setUploading(false);
    };

    // ─── Article Detail View ──────────────────────────────────────────────────
    if (selectedArticle) {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl">
                    <button
                        onClick={() => setSelectedArticle(null)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-3"
                    >
                        <ChevronLeft size={18} />
                        <span className="text-sm font-bold">返回 SOP 列表</span>
                    </button>
                    <h1 className="text-2xl font-black text-white">{selectedArticle.title}</h1>
                    <p className="text-gray-400 text-sm mt-1">{selectedArticle.description}</p>
                    <div className="flex gap-2 mt-3">
                        {selectedArticle.target_roles.map(r => (
                            <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '22', color: ROLE_COLORS[r] || '#666' }}>
                                {r}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Video Player */}
                    {selectedArticle.video_url && (
                        <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-gray-800/50">
                            <video
                                src={selectedArticle.video_url}
                                controls
                                className="w-full max-h-[500px] object-contain"
                                playsInline
                            />
                        </div>
                    )}

                    {/* Markdown-like content */}
                    <div className="prose prose-invert max-w-none">
                        {selectedArticle.content.split('\n').map((line, i) => {
                            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-white mt-6 mb-2">{line.slice(4)}</h3>;
                            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">{line.slice(3)}</h2>;
                            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-black text-white mt-8 mb-4">{line.slice(2)}</h1>;
                            if (line.startsWith('- ')) return <li key={i} className="text-gray-300 ml-4 list-disc">{line.slice(2)}</li>;
                            if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-blue-500 pl-4 text-gray-400 italic my-2">{line.slice(2)}</blockquote>;
                            if (line.trim() === '') return <div key={i} className="h-3" />;
                            return <p key={i} className="text-gray-300 leading-relaxed">{line}</p>;
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Edit Modal (inline to prevent focus loss) ─────────────────────────────

    // ─── Main List View ───────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <BookOpen size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">SOP 指南中心</h1>
                            <p className="text-xs text-gray-500">{filteredArticles.length} 篇操作指南</p>
                        </div>
                    </div>

                    {isAdmin && (
                        <button onClick={handleCreate}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
                            <Plus size={16} />
                            新建 SOP
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="搜索 SOP..."
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                        <FileText size={48} className="mb-4 opacity-30" />
                        <p className="font-bold">暂无 SOP 内容</p>
                        {isAdmin && <p className="text-sm mt-1">点击「新建 SOP」开始创建</p>}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredArticles.map(article => (
                            <div
                                key={article.id}
                                className="group relative bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
                                onClick={() => setSelectedArticle(article)}
                            >
                                {/* Video Thumbnail / Gradient Placeholder */}
                                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-indigo-950/80 to-purple-950/40">
                                    {article.video_url ? (
                                        <video
                                            src={article.video_url}
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                            muted
                                            preload="metadata"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <FileText size={40} className="text-indigo-500/30" />
                                        </div>
                                    )}

                                    {/* Play button overlay */}
                                    {article.video_url && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                                                <Play size={20} className="text-white ml-1" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Published Badge */}
                                    {isAdmin && !article.is_published && (
                                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold">
                                            草稿
                                        </div>
                                    )}

                                    {/* Admin Actions */}
                                    {isAdmin && (
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleEdit(article); }}
                                                className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-blue-500/50 transition-colors"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                                className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-red-500/50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Card Content */}
                                <div className="p-4">
                                    <h3 className="text-white font-bold text-sm mb-1 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                                        {article.title}
                                    </h3>
                                    <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">
                                        {article.description || article.content.slice(0, 100)}
                                    </p>

                                    {/* Role Tags */}
                                    <div className="flex flex-wrap gap-1 mt-3">
                                        {article.target_roles.length === 0 ? (
                                            <span className="px-2 py-0.5 rounded-full bg-gray-800/50 text-gray-500 text-[10px] font-bold">
                                                所有人
                                            </span>
                                        ) : (
                                            article.target_roles.slice(0, 3).map(r => (
                                                <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                                    style={{ backgroundColor: (ROLE_COLORS[r] || '#666') + '18', color: ROLE_COLORS[r] || '#666' }}>
                                                    {r}
                                                </span>
                                            ))
                                        )}
                                        {article.target_roles.length > 3 && (
                                            <span className="px-2 py-0.5 rounded-full bg-gray-800/50 text-gray-500 text-[10px] font-bold">
                                                +{article.target_roles.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal — rendered inline to prevent re-mount focus loss */}
            {isEditing && editArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                            <h2 className="text-lg font-black text-white">
                                {editArticle.id ? '✏️ 编辑 SOP' : '➕ 新建 SOP'}
                            </h2>
                            <button onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Title */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">标题 Title</label>
                                <input
                                    value={editArticle.title || ''}
                                    onChange={e => setEditArticle(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                    placeholder="如：如何开始生产"
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">简述 Description</label>
                                <input
                                    value={editArticle.description || ''}
                                    onChange={e => setEditArticle(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                    placeholder="一句话说明这篇 SOP 的用途"
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Video Upload */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">视频 Video</label>
                                {editArticle.video_url ? (
                                    <div className="relative rounded-xl overflow-hidden bg-black border border-gray-800">
                                        <video src={editArticle.video_url} controls className="w-full max-h-48 object-contain" />
                                        <button
                                            onClick={() => setEditArticle(prev => prev ? { ...prev, video_url: '' } : prev)}
                                            className="absolute top-2 right-2 bg-red-500/80 text-white p-1.5 rounded-lg hover:bg-red-500"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="w-full py-8 rounded-xl border-2 border-dashed border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-400 transition-all flex flex-col items-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                                                <span className="text-sm">上传中...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={24} />
                                                <span className="text-sm font-bold">点击上传视频</span>
                                                <span className="text-xs text-gray-600">MP4, WebM, MOV · 最大 50MB</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVideoUpload(file);
                                    }}
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">正文内容 Content (Markdown)</label>
                                <textarea
                                    value={editArticle.content || ''}
                                    onChange={e => setEditArticle(prev => prev ? { ...prev, content: e.target.value } : prev)}
                                    placeholder={"# 标题\n\n## 步骤一\n\n- 打开系统\n- 选择机器\n\n## 步骤二\n\n详细文字说明..."}
                                    rows={10}
                                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white font-mono text-sm focus:border-blue-500 outline-none resize-y"
                                />
                            </div>

                            {/* Target Roles */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">适用角色 Target Roles</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.map(role => {
                                        const isSelected = editArticle.target_roles?.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                onClick={() => {
                                                    setEditArticle(prev => {
                                                        if (!prev) return prev;
                                                        const roles = prev.target_roles || [];
                                                        return {
                                                            ...prev,
                                                            target_roles: isSelected
                                                                ? roles.filter(r => r !== role)
                                                                : [...roles, role]
                                                        };
                                                    });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected
                                                    ? 'border-white/30 scale-105'
                                                    : 'border-gray-800 opacity-50 hover:opacity-100'
                                                    }`}
                                                style={{
                                                    backgroundColor: isSelected ? (ROLE_COLORS[role] || '#666') + '22' : 'transparent',
                                                    color: ROLE_COLORS[role] || '#666'
                                                }}
                                            >
                                                {role}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-600 mt-1">不选 = 所有角色可见</p>
                            </div>

                            {/* Page ID + Published */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">关联页面 Page ID</label>
                                    <input
                                        value={editArticle.page_id || ''}
                                        onChange={e => setEditArticle(prev => prev ? { ...prev, page_id: e.target.value } : prev)}
                                        placeholder="如 scanner, stock-movement"
                                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">发布状态</label>
                                    <button
                                        onClick={() => setEditArticle(prev => prev ? { ...prev, is_published: !prev.is_published } : prev)}
                                        className={`w-full py-3 rounded-lg font-bold text-sm transition-all border ${editArticle.is_published
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : 'bg-gray-900 border-gray-800 text-gray-500'
                                            }`}
                                    >
                                        {editArticle.is_published ? '✅ 已发布' : '🔒 草稿'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
                            <button onClick={() => { setIsEditing(false); setEditArticle(null); }}
                                className="px-5 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold text-sm">
                                取消
                            </button>
                            <button onClick={handleSave}
                                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20">
                                <Save size={16} />
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SOPCenter;
