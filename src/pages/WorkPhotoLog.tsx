import { useState, useEffect, useRef } from 'react';
import { Camera, Send, Loader, Tag, AlertTriangle, Clock, X, Sparkles, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface WorkPhoto {
    id: string;
    employee_id: string;
    employee_name: string;
    photo_url: string;
    ai_description: string;
    user_note: string;
    category: string;
    ai_tags: string[];
    risk_flag: boolean;
    risk_reason: string;
    created_at: string;
}

interface AIResult {
    description: string;
    category: string;
    tags: string[];
    risk_flag: boolean;
    risk_reason: string;
}

const CATEGORIES: Record<string, { label: string; emoji: string; color: string }> = {
    production: { label: '生产', emoji: '🏭', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    maintenance: { label: '维修', emoji: '🔧', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    safety: { label: '安全', emoji: '🦺', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    logistics: { label: '物流', emoji: '📦', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    cleaning: { label: '清洁', emoji: '🧹', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    other: { label: '其他', emoji: '📋', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

interface Props {
    user: User | null;
}

// Image compression utility
const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const WorkPhotoLog: React.FC<Props> = ({ user }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBase64, setPreviewBase64] = useState<string | null>(null);
    const [aiResult, setAiResult] = useState<AIResult | null>(null);
    const [userNote, setUserNote] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [selectedPhoto, setSelectedPhoto] = useState<WorkPhoto | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role === 'Manager';

    // Load photos
    const loadPhotos = async () => {
        setLoading(true);
        let query = supabase
            .from('work_photos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        // Non-admin only sees their own
        if (!isAdmin && user?.employeeId) {
            query = query.eq('employee_id', user.employeeId);
        }

        if (filterCategory !== 'all') {
            query = query.eq('category', filterCategory);
        }

        const { data, error } = await query;
        if (error) console.error('Load photos error:', error);
        setPhotos(data || []);
        setLoading(false);
    };

    useEffect(() => { loadPhotos(); }, [filterCategory]);

    // Handle file selection
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            // Compress image
            const dataUrl = await compressImage(file);
            setPreviewUrl(dataUrl);

            // Extract base64 (strip data:image/jpeg;base64, prefix)
            const base64 = dataUrl.split(',')[1];
            setPreviewBase64(base64);

            // Call AI
            setAnalyzing(true);
            try {
                const res = await fetch('/api/agent/ai-photo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64 })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'AI analysis failed');
                }

                const result: AIResult = await res.json();
                setAiResult(result);
            } catch (aiErr: any) {
                console.error('AI Error:', aiErr);
                // Fallback: let user fill manually
                setAiResult({
                    description: '',
                    category: 'other',
                    tags: [],
                    risk_flag: false,
                    risk_reason: ''
                });
            }
            setAnalyzing(false);
        } catch (err: any) {
            console.error('File process error:', err);
            alert('处理图片失败: ' + err.message);
        } finally {
            setUploading(false);
        }
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Submit photo
    const handleSubmit = async () => {
        if (!previewBase64 || !aiResult || !user) return;
        setUploading(true);

        try {
            // 1. Upload to Supabase Storage
            const fileName = `${user.employeeId || 'unknown'}_${Date.now()}.jpg`;
            const blob = await fetch(`data:image/jpeg;base64,${previewBase64}`).then(r => r.blob());

            const { error: uploadError } = await supabase.storage
                .from('work-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
            const photoUrl = urlData.publicUrl;

            // 3. Insert record
            const { error: dbError } = await supabase.from('work_photos').insert({
                employee_id: user.employeeId || 'unknown',
                employee_name: user.name || 'Unknown',
                photo_url: photoUrl,
                ai_description: aiResult.description,
                user_note: userNote,
                category: aiResult.category,
                ai_tags: aiResult.tags,
                risk_flag: aiResult.risk_flag,
                risk_reason: aiResult.risk_reason,
            });

            if (dbError) throw dbError;

            // Reset
            setPreviewUrl(null);
            setPreviewBase64(null);
            setAiResult(null);
            setUserNote('');
            loadPhotos();
        } catch (err: any) {
            alert('上传失败: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    const cancelUpload = () => {
        setPreviewUrl(null);
        setPreviewBase64(null);
        setAiResult(null);
        setUserNote('');
    };

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const todayCount = photos.filter(p => {
        const d = new Date(p.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }).length;

    const riskCount = photos.filter(p => p.risk_flag).length;

    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-900/30 via-[#09090b] to-fuchsia-900/30 border-b border-white/5">
                <div className="max-w-5xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <Camera size={22} />
                                </div>
                                工作记录
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">AI 智能分析 · 拍照即记录</p>
                        </div>
                        <div className="flex gap-3 text-xs">
                            <div className="bg-violet-500/10 border border-violet-500/20 px-3 py-2 rounded-xl">
                                <span className="text-violet-400 font-bold">📷 今天 {todayCount}</span>
                            </div>
                            {riskCount > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                                    <span className="text-red-400 font-bold">⚠️ 风险 {riskCount}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Upload Area */}
                {!previewUrl ? (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-12 rounded-2xl border-2 border-dashed border-violet-500/30 hover:border-violet-500/60 bg-violet-500/5 hover:bg-violet-500/10 transition-all group flex flex-col items-center gap-4"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-500/30 group-hover:scale-110 transition-transform">
                            <Camera size={32} className="text-white" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-white">拍照或选择图片</p>
                            <p className="text-xs text-gray-500 mt-1">AI 自动分析工作内容 · 生成标签</p>
                        </div>
                    </button>
                ) : (
                    /* Preview + AI Result */
                    <div className="rounded-2xl border border-white/10 bg-[#0c0c0e] overflow-hidden">
                        {/* Preview Image */}
                        <div className="relative">
                            <img src={previewUrl} alt="Preview" className="w-full max-h-80 object-contain bg-black" />
                            <button onClick={cancelUpload} className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-red-500/80 transition-colors">
                                <X size={16} />
                            </button>
                            {analyzing && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                                    <Sparkles size={32} className="text-violet-400 animate-pulse" />
                                    <span className="text-sm font-bold text-violet-300 animate-pulse">AI 分析中...</span>
                                </div>
                            )}
                        </div>

                        {/* AI Result */}
                        {aiResult && !analyzing && (
                            <div className="p-5 space-y-4">
                                {/* Risk Alert */}
                                {aiResult.risk_flag && (
                                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-red-300">⚠️ AI 检测到安全隐患</p>
                                            <p className="text-xs text-red-400/80 mt-1">{aiResult.risk_reason}</p>
                                        </div>
                                    </div>
                                )}

                                {/* AI Description */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">
                                        <Sparkles size={10} className="inline mr-1" />AI 描述
                                    </label>
                                    <input
                                        value={aiResult.description}
                                        onChange={e => setAiResult(prev => prev ? { ...prev, description: e.target.value } : prev)}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-violet-500 outline-none"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">分类</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                                            <button
                                                key={key}
                                                onClick={() => setAiResult(prev => prev ? { ...prev, category: key } : prev)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${aiResult.category === key
                                                    ? cat.color + ' scale-105'
                                                    : 'border-gray-800 text-gray-500 hover:text-gray-300'
                                                    }`}
                                            >
                                                {cat.emoji} {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags */}
                                {aiResult.tags.length > 0 && (
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 block">
                                            <Tag size={10} className="inline mr-1" />AI 标签
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {aiResult.tags.map((tag, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* User Note */}
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1 block">补充备注（可选）</label>
                                    <input
                                        value={userNote}
                                        onChange={e => setUserNote(e.target.value)}
                                        placeholder="手动添加备注..."
                                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-violet-500 outline-none"
                                    />
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <><Loader size={16} className="animate-spin" /> 提交中...</>
                                    ) : (
                                        <><Send size={16} /> 提交记录</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                />

                {/* Filter Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={loadPhotos}
                        className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors shrink-0"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setFilterCategory('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${filterCategory === 'all'
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        全部
                    </button>
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                        <button
                            key={key}
                            onClick={() => setFilterCategory(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shrink-0 ${filterCategory === key
                                ? cat.color
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {cat.emoji} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Timeline */}
                {loading ? (
                    <div className="text-center py-20 text-gray-600 animate-pulse">加载中...</div>
                ) : photos.length === 0 ? (
                    <div className="text-center py-20">
                        <ImageIcon size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-500 font-bold">暂无记录</p>
                        <p className="text-gray-600 text-sm mt-1">拍一张照片开始记录工作吧</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {photos.map(photo => {
                            const cat = CATEGORIES[photo.category] || CATEGORIES.other;
                            return (
                                <div
                                    key={photo.id}
                                    onClick={() => setSelectedPhoto(photo)}
                                    className="rounded-2xl border border-white/5 bg-[#0c0c0e] overflow-hidden hover:border-white/15 transition-all cursor-pointer group"
                                >
                                    <div className="relative aspect-video bg-black overflow-hidden">
                                        <img
                                            src={photo.photo_url}
                                            alt=""
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                        {photo.risk_flag && (
                                            <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-bold flex items-center gap-1">
                                                <AlertTriangle size={10} /> 风险
                                            </div>
                                        )}
                                        <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-bold border ${cat.color}`}>
                                            {cat.emoji} {cat.label}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-sm text-gray-200 line-clamp-2">{photo.ai_description || photo.user_note || '无描述'}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] text-gray-500 font-bold">{photo.employee_name}</span>
                                            <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                                <Clock size={10} /> {formatTime(photo.created_at)}
                                            </span>
                                        </div>
                                        {photo.ai_tags && photo.ai_tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {photo.ai_tags.slice(0, 3).map((tag, i) => (
                                                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Photo Detail Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedPhoto(null)}>
                    <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <img src={selectedPhoto.photo_url} alt="" className="w-full max-h-96 object-contain bg-black" />
                        <div className="p-5 space-y-3">
                            {selectedPhoto.risk_flag && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                    <AlertTriangle size={16} className="text-red-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-red-300">安全隐患</p>
                                        <p className="text-xs text-red-400/80 mt-0.5">{selectedPhoto.risk_reason}</p>
                                    </div>
                                </div>
                            )}
                            <p className="text-white font-bold">{selectedPhoto.ai_description}</p>
                            {selectedPhoto.user_note && <p className="text-gray-400 text-sm">📝 {selectedPhoto.user_note}</p>}
                            <div className="flex flex-wrap gap-2">
                                {selectedPhoto.ai_tags?.map((tag, i) => (
                                    <span key={i} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">#{tag}</span>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-white/5 text-xs text-gray-500">
                                <span>{selectedPhoto.employee_name}</span>
                                <span>{new Date(selectedPhoto.created_at).toLocaleString('zh-CN')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkPhotoLog;
