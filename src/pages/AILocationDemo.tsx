import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Search, Sparkles, MapPin, X, CheckCircle, AlertTriangle } from 'lucide-react';

// We call the Gemini API via our Vercel endpoint (production) or directly via supabase RPC (local dev)
// For local testing, we'll use a simplified client-side approach

const AILocationDemo: React.FC = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!input.trim()) return;
        setIsSearching(true);
        setError('');
        setResults([]);

        try {
            // Step 1: Get embedding from Gemini API
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const embRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/gemini-embedding-001',
                        content: { parts: [{ text: input.trim() }] }
                    })
                }
            );
            const embData = await embRes.json();
            if (!embRes.ok) throw new Error(embData.error?.message || 'Embedding API failed');
            const embedding = embData.embedding.values;

            // Step 2: Search via Supabase RPC
            const { data: matches, error: rpcErr } = await supabase.rpc('match_location', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5
            });

            if (rpcErr) throw new Error(rpcErr.message);
            setResults((matches || []).map((m: any) => ({
                location_name: m.location_name,
                similarity: Math.round(m.similarity * 1000) / 10
            })));
        } catch (e: any) {
            setError(e.message || 'Network error');
        }

        setIsSearching(false);
    };

    const getIcon = (similarity: number) => {
        if (similarity >= 85) return <CheckCircle className="text-green-400" size={20} />;
        if (similarity >= 70) return <AlertTriangle className="text-yellow-400" size={20} />;
        return <X className="text-red-400" size={20} />;
    };

    const getColor = (similarity: number) => {
        if (similarity >= 85) return 'border-green-500/40 bg-green-500/10';
        if (similarity >= 70) return 'border-yellow-500/40 bg-yellow-500/10';
        return 'border-red-500/40 bg-red-500/10';
    };

    const getLabel = (similarity: number) => {
        if (similarity >= 85) return '✅ 自动匹配';
        if (similarity >= 70) return '⚠️ 需要确认';
        return '❌ 不匹配';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/30 to-gray-950 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-2xl px-6 py-3 mb-4">
                        <Sparkles className="text-purple-400" size={24} />
                        <span className="text-purple-300 font-bold text-sm uppercase tracking-widest">AI Semantic Matching</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2">智能地点匹配测试</h1>
                    <p className="text-gray-400 text-sm">试试打一些缩写、错别字、甚至中文，看 AI 能不能认出你要去的地方！</p>
                </div>

                {/* Search Box */}
                <div className="relative mb-8">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="输入地点名称... 例如: sg petani, Alor Star, 去槟城"
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border-2 border-white/10 rounded-2xl text-white text-lg font-medium placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !input.trim()}
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 rounded-2xl text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                        >
                            {isSearching ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search size={20} />
                            )}
                            {isSearching ? '分析中...' : '搜索'}
                        </button>
                    </div>

                    {/* Quick Test Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {['Alor Star', 'sg petani', 'BM', 'Johor Bahru', '去槟城', 'Sg Buloh', 'ipoh'].map(term => (
                            <button
                                key={term}
                                onClick={() => { setInput(term); }}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white transition-all"
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Results */}
                {results.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                            AI 匹配结果 ({results.length} 个候选)
                        </h2>
                        {results.map((match, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${getColor(match.similarity)}`}
                            >
                                <div className="flex items-center gap-4">
                                    {getIcon(match.similarity)}
                                    <div>
                                        <p className="text-white font-bold text-lg">{match.location_name}</p>
                                        <p className="text-gray-400 text-xs">{getLabel(match.similarity)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-2xl font-black ${match.similarity >= 85 ? 'text-green-400' : match.similarity >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {match.similarity}%
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">相似度</p>
                                </div>
                            </div>
                        ))}

                        {/* Verdict */}
                        <div className="mt-6 p-5 rounded-2xl border border-white/10 bg-white/5">
                            {results[0]?.similarity >= 85 ? (
                                <p className="text-green-400 font-bold">
                                    ✅ AI 判定：<span className="text-white">"{input}"</span> = <span className="text-green-300">{results[0].location_name}</span>（信心指数 {results[0].similarity}%，超过 85% 门槛，自动匹配！）
                                </p>
                            ) : results[0]?.similarity >= 70 ? (
                                <p className="text-yellow-400 font-bold">
                                    ⚠️ AI 判定：<span className="text-white">"{input}"</span> 可能是 <span className="text-yellow-300">{results[0].location_name}</span>（{results[0].similarity}%），但信心不足 85%，需要人工确认。
                                </p>
                            ) : (
                                <p className="text-red-400 font-bold">
                                    ❌ AI 判定：<span className="text-white">"{input}"</span> 在 HR 费率表中没有找到匹配的地点，业务员需手动选择或新建。
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isSearching && results.length === 0 && !error && (
                    <div className="text-center py-20">
                        <Sparkles className="text-purple-500/30 mx-auto mb-4" size={48} />
                        <p className="text-gray-600">在上方输入任意地点名称，AI 会从 HR 费率表中<br/>找出最接近的标准地名</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AILocationDemo;
