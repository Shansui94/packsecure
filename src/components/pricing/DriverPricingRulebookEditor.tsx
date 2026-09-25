import React, { useState, useEffect, useTransition } from 'react';
import {
    fetchActiveRulebook,
    fetchRulebookHistory,
    saveNewRulebook,
    runSandboxTest,
    runHistoricalBacktest,
    fetchRulePatchSuggestions,
    PricingRulebook,
    SandboxResult,
    BacktestReport,
    RulePatchSuggestion
} from '../../utils/aiDriverPricing';

export const DriverPricingRulebookEditor: React.FC = () => {
    const [rulebookContent, setRulebookContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [currentVersion, setCurrentVersion] = useState<string>('v1.0.0');
    const [historyList, setHistoryList] = useState<PricingRulebook[]>([]);
    const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'sandbox' | 'backtest'>('editor');
    
    // UI state
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
    const [changelog, setChangelog] = useState<string>('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    // Sandbox state
    const [sandboxAddress, setSandboxAddress] = useState<string>('Lot 1826, Jalan Perindustrian Bukit Minyak, 14100 Simpang Ampat, Pulau Pinang');
    const [sandboxPlate, setSandboxPlate] = useState<string>('PGD 1234');
    const [sandboxDrops, setSandboxDrops] = useState<number>(2);
    const [sandboxOrigin, setSandboxOrigin] = useState<string>('TAIPING');
    const [sandboxRunning, setSandboxRunning] = useState<boolean>(false);
    const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);

    // Backtest state
    const [backtestRunning, setBacktestRunning] = useState<boolean>(false);
    const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null);

    // AI Suggestions
    const [suggestions, setSuggestions] = useState<RulePatchSuggestion[]>([]);
    const [suggestionsSummary, setSuggestionsSummary] = useState<string>('');
    const [unabsorbedCount, setUnabsorbedCount] = useState<number>(0);

    const isDirty = rulebookContent !== originalContent;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const active = await fetchActiveRulebook();
            setRulebookContent(active.content);
            setOriginalContent(active.content);
            setCurrentVersion(active.version);

            const history = await fetchRulebookHistory();
            setHistoryList(history);

            const patchData = await fetchRulePatchSuggestions();
            if (patchData.hasSuggestions && patchData.suggestions.length > 0) {
                setSuggestions(patchData.suggestions);
                setSuggestionsSummary(patchData.summary || '');
                setUnabsorbedCount(patchData.unabsorbedCount || 0);
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: '加载规则库失败: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleVersionSwitch = (v: PricingRulebook) => {
        if (isDirty && !window.confirm('当前有未保存的修改，切换版本将丢失修改，是否继续？')) {
            return;
        }
        setRulebookContent(v.content_md);
        setOriginalContent(v.content_md);
        setCurrentVersion(v.version);
        setStatusMessage({ type: 'info', text: `已载入历史版本 ${v.version}` });
    };

    const handleApplySuggestion = (sug: RulePatchSuggestion) => {
        const patchBlock = `\n\n### 规则增补补丁: ${sug.title}\n${sug.markdownPatch}\n*(AI 根据近期 HR 人工调价案例自动提炼)*\n`;
        setRulebookContent(prev => prev + patchBlock);
        setStatusMessage({ type: 'success', text: `已将补丁「${sug.title}」追加到规则正文末尾，请核对后保存！` });
    };

    const handleRunSandbox = async () => {
        if (!sandboxAddress.trim()) return;
        setSandboxRunning(true);
        setSandboxResult(null);
        try {
            const res = await runSandboxTest({
                testAddress: sandboxAddress.trim(),
                origin: sandboxOrigin,
                lorryPlate: sandboxPlate,
                dropCount: sandboxDrops,
                rulebookMd: rulebookContent
            });
            setSandboxResult(res);
        } catch (err: any) {
            alert('沙盒试算失败: ' + err.message);
        } finally {
            setSandboxRunning(false);
        }
    };

    const handleRunBacktest = async () => {
        setBacktestRunning(true);
        try {
            const report = await runHistoricalBacktest({
                rulebookMd: rulebookContent,
                limit: 30
            });
            setBacktestReport(report);
            setActiveTab('backtest');
        } catch (err: any) {
            alert('历史回测失败: ' + err.message);
        } finally {
            setBacktestRunning(false);
        }
    };

    const handleConfirmPublish = async () => {
        if (!changelog.trim()) {
            alert('请简要填写本次修改说明（Changelog），以便日后追溯复核！');
            return;
        }
        setSaving(true);
        try {
            const res = await saveNewRulebook({
                content_md: rulebookContent,
                changelog: changelog.trim(),
                created_by: 'HR Admin'
            });
            setStatusMessage({ type: 'success', text: res.message || '规则已成功热发布！' });
            setSaveModalOpen(false);
            setChangelog('');
            loadData();
        } catch (err: any) {
            alert('发布失败: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-500">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                正在载入运费真理库 (Rulebook)...
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
            {/* Header & Version Indicator */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                    <span className="text-2xl">📜</span>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-lg font-bold text-slate-100">司机运费与送货价格真理库 (Pricing Rulebook)</h2>
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2 py-0.5 rounded font-mono font-bold">
                                {currentVersion} (ACTIVE)
                            </span>
                            {isDirty && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2 py-0.5 rounded animate-pulse">
                                    ● 存在未发布草案
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            支持在前端直接修改 Markdown 规则，经沙盒与 50 单回测自检后一键热生效，全系统秒级同步。
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Version History Selector */}
                    {historyList.length > 0 && (
                        <div className="flex items-center space-x-1 text-xs text-slate-300">
                            <span>历史版本:</span>
                            <select
                                value={currentVersion}
                                onChange={(e) => {
                                    const target = historyList.find(h => h.version === e.target.value);
                                    if (target) handleVersionSwitch(target);
                                }}
                                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                            >
                                {historyList.map(h => (
                                    <option key={h.id || h.version} value={h.version}>
                                        {h.version} {h.is_active ? '★ (生效中)' : ''} - {h.changelog || '版本记录'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => setSaveModalOpen(true)}
                        disabled={!isDirty}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm ${
                            isDirty
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer ring-2 ring-indigo-400/50'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                    >
                        <span>🚀</span>
                        <span>发布新版本 (Publish)</span>
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {statusMessage && (
                <div className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                    'bg-sky-50 text-sky-800 border-sky-200'
                }`}>
                    <span>{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-700 font-bold ml-4">✕</button>
                </div>
            )}

            {/* AI Rule Patch Suggestion Banner */}
            {suggestions.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <span className="text-xl">💡</span>
                            <div>
                                <h4 className="text-xs font-bold text-amber-900">
                                    AI 闭环反哺建议：发现 {unabsorbedCount} 条 HR 近期人工调价纠错案例
                                </h4>
                                <p className="text-xs text-amber-800/90 mt-0.5 max-w-3xl">
                                    {suggestionsSummary || '系统分析了近期被人工修正的订单地址模式，建议将以下规范条款增补至规则库中：'}
                                </p>
                                <div className="mt-2 space-y-1.5">
                                    {suggestions.map((sug, idx) => (
                                        <div key={idx} className="bg-white/80 border border-amber-200 rounded p-2 text-xs flex items-center justify-between">
                                            <div>
                                                <span className="font-semibold text-slate-800 mr-2">[{sug.title}]</span>
                                                <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono text-[11px]">
                                                    {sug.markdownPatch}
                                                </code>
                                            </div>
                                            <button
                                                onClick={() => handleApplySuggestion(sug)}
                                                className="ml-4 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition whitespace-nowrap cursor-pointer"
                                            >
                                                + 一键合并入草案
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setSuggestions([])}
                            className="text-amber-500 hover:text-amber-700 text-xs ml-4"
                            title="稍后忽略"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Sub-tabs toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex items-center justify-between">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === 'editor'
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        ✏️ Markdown 编辑器
                    </button>
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === 'preview'
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        👁️ 实时排版预览
                    </button>
                    <button
                        onClick={() => setActiveTab('sandbox')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === 'sandbox'
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        🧪 沙盒单测模拟器
                    </button>
                    <button
                        onClick={() => setActiveTab('backtest')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeTab === 'backtest'
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200 font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        📊 历史批次回测 (Backtest)
                    </button>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleRunBacktest}
                        disabled={backtestRunning}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition flex items-center space-x-1"
                    >
                        {backtestRunning ? (
                            <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span>⚡</span>
                        )}
                        <span>{backtestRunning ? '回测跑单中...' : '一键回测防翻车'}</span>
                    </button>
                </div>
            </div>

            {/* Tab 1: Editor View */}
            {activeTab === 'editor' && (
                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>提示：可随时编辑文字、表格、特殊车型规则与偏远补贴。LLM 将直接以此文本作为最高计算真理。</span>
                        <span>{rulebookContent.length} 字符 | 行数: {rulebookContent.split('\n').length}</span>
                    </div>
                    <textarea
                        value={rulebookContent}
                        onChange={(e) => setRulebookContent(e.target.value)}
                        className="w-full flex-1 min-h-[480px] p-4 font-mono text-xs bg-slate-950 text-slate-200 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y selection:bg-indigo-600 selection:text-white"
                        placeholder="在此输入 Markdown 格式的司机运费规则..."
                        spellCheck={false}
                    />
                </div>
            )}

            {/* Tab 2: Formatted Preview */}
            {activeTab === 'preview' && (
                <div className="p-8 flex-1 overflow-y-auto max-h-[620px] prose prose-slate max-w-none text-xs leading-relaxed">
                    <div className="whitespace-pre-wrap font-sans bg-slate-50 p-6 rounded-lg border border-slate-200">
                        {rulebookContent}
                    </div>
                </div>
            )}

            {/* Tab 3: Sandbox Single Address Simulator */}
            {activeTab === 'sandbox' && (
                <div className="p-6 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="border-b border-slate-200 pb-2">
                            <h3 className="text-sm font-bold text-slate-800">沙盒即时单地址测试</h3>
                            <p className="text-xs text-slate-500">输入任意杂乱的工厂地址或地名，测试新规则下的 AI 解析与计费。</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">测试送货地址 (支持输入地名、工业区、错别字或长串详细地址):</label>
                            <textarea
                                value={sandboxAddress}
                                onChange={(e) => setSandboxAddress(e.target.value)}
                                rows={3}
                                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono"
                                placeholder="如: Kawasan Perindustrian Batu Kawan, Lot 23, Simpang Ampat"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">出发厂区:</label>
                                <select
                                    value={sandboxOrigin}
                                    onChange={(e) => setSandboxOrigin(e.target.value)}
                                    className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                                >
                                    <option value="TAIPING">TAIPING (OPM Lama)</option>
                                    <option value="NILAI">NILAI (汝来)</option>
                                    <option value="KELANTAN">KELANTAN</option>
                                    <option value="JOHOR">JOHOR</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">派送车辆:</label>
                                <select
                                    value={sandboxPlate}
                                    onChange={(e) => setSandboxPlate(e.target.value)}
                                    className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                                >
                                    <option value="PGD 1234">标准罗里 (82卷)</option>
                                    <option value="VPC 9821">VPC 9821 (65卷小车)</option>
                                    <option value="APH 9821">APH 9821 (92卷大车)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">落点数量 (Drops):</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={sandboxDrops}
                                    onChange={(e) => setSandboxDrops(parseInt(e.target.value) || 1)}
                                    className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleRunSandbox}
                            disabled={sandboxRunning}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                        >
                            {sandboxRunning ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>AI 运算中 (Gemini 2.5 Flash)...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>开始沙盒核算 (Run Sandbox Test)</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Result Output Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                                <h4 className="text-xs font-bold text-slate-800">沙盒核算报告</h4>
                                {sandboxResult && (
                                    <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-indigo-100 text-indigo-700">
                                        置信度: {((sandboxResult.confidence_score || 0.9) * 100).toFixed(0)}%
                                    </span>
                                )}
                            </div>

                            {!sandboxResult && !sandboxRunning && (
                                <div className="text-center py-16 text-slate-400 text-xs">
                                    👈 在左侧填写测试地址后点击“开始沙盒核算”，此处将展示 AI 标准化地理识别与运费阶梯推导过程。
                                </div>
                            )}

                            {sandboxRunning && (
                                <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center">
                                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                                    正在结合当前 Markdown 规则进行语义推理与阶梯归属判定...
                                </div>
                            )}

                            {sandboxResult && !sandboxRunning && (
                                <div className="space-y-3 text-xs">
                                    {/* Dual-engine price compare */}
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                        <div>
                                            <div className="text-[11px] text-slate-500">原系统传统查表价</div>
                                            <div className="text-lg font-bold text-slate-700">RM {sandboxResult.legacy_rate.toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-indigo-600 font-semibold">AI 智能核算价 (当前规则)</div>
                                            <div className="text-lg font-black text-indigo-700">RM {sandboxResult.ai_rate.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">识别标准位置:</span>
                                            <span className="font-semibold text-slate-800">{sandboxResult.standardized_location}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">匹配计费阶梯:</span>
                                            <span className="font-semibold text-indigo-600">{sandboxResult.ai_zone}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">基础价 + 超点补贴:</span>
                                            <span className="font-mono text-slate-800">
                                                RM {sandboxResult.base_rate} + RM {sandboxResult.extra_drops_rate}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Reasoning & Citations */}
                                    <div className="bg-indigo-50/60 p-3 rounded-lg border border-indigo-100">
                                        <div className="font-bold text-indigo-900 mb-1">推导依据与引用条款:</div>
                                        <p className="text-indigo-900/90 leading-relaxed mb-2">{sandboxResult.reasoning}</p>
                                        <div className="space-y-1">
                                            {sandboxResult.rule_citations?.map((c, i) => (
                                                <div key={i} className="text-[11px] text-indigo-700 flex items-center space-x-1">
                                                    <span>📌</span>
                                                    <span>{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 4: Historical 50-Trip Backtest Engine */}
            {activeTab === 'backtest' && (
                <div className="p-6 flex-1 flex flex-col space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">历史批次回测报告 (Backtest Guardrail)</h3>
                            <p className="text-xs text-slate-500">拿真实已完成的历史订单，用当前 Markdown 规则跑一遍，验证总运费变动幅度与异常率。</p>
                        </div>
                        <button
                            onClick={handleRunBacktest}
                            disabled={backtestRunning}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                        >
                            {backtestRunning ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span>⚡</span>
                            )}
                            <span>{backtestRunning ? '正在回测真实历史订单...' : '重新运行回测'}</span>
                        </button>
                    </div>

                    {!backtestReport && !backtestRunning && (
                        <div className="text-center py-20 text-slate-400 text-xs">
                            点击右上角「一键回测防翻车」按钮，系统将自动抽取最近的历史订单进行新旧规则全景对比。
                        </div>
                    )}

                    {backtestReport && (
                        <div className="space-y-4">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                    <div className="text-[11px] text-slate-500">抽样测试单数</div>
                                    <div className="text-xl font-black text-slate-800">{backtestReport.totalTested} 趟</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">历史真实订单</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                    <div className="text-[11px] text-slate-500">老规则总运费</div>
                                    <div className="text-xl font-black text-slate-700">RM {backtestReport.legacyTotal.toFixed(2)}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">静态查表总额</div>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl">
                                    <div className="text-[11px] text-indigo-600 font-semibold">新规则总运费</div>
                                    <div className="text-xl font-black text-indigo-700">RM {backtestReport.aiTotal.toFixed(2)}</div>
                                    <div className="text-[10px] text-indigo-500 mt-0.5">AI 规则核算总额</div>
                                </div>
                                <div className={`p-3 rounded-xl border ${
                                    Math.abs(backtestReport.netDiff) < 50
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                        : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                    <div className="text-[11px]">全盘波动幅度</div>
                                    <div className="text-xl font-black">{backtestReport.netDiff >= 0 ? '+' : ''}{backtestReport.netDiffPercent}</div>
                                    <div className="text-[10px] mt-0.5">净差额: RM {backtestReport.netDiff.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Breakdown Status Tags */}
                            <div className="flex items-center space-x-3 text-xs">
                                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                                    🟢 完全吻合: {backtestReport.matchCount} 笔
                                </span>
                                <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold">
                                    ⭐ AI 补全地名: {backtestReport.enrichedCount} 笔
                                </span>
                                <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-bold">
                                    ℹ️ 轻度差异: {backtestReport.driftCount} 笔
                                </span>
                                <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold">
                                    🚨 大额差异: {backtestReport.discrepancyCount} 笔
                                </span>
                            </div>

                            {/* Comparisons Table */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="p-2.5">单号 / 客户</th>
                                            <th className="p-2.5">送货地址 (原文本)</th>
                                            <th className="p-2.5">老系统价</th>
                                            <th className="p-2.5">新规则 AI 价</th>
                                            <th className="p-2.5">差额</th>
                                            <th className="p-2.5">AI 推理判定理由</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {backtestReport.comparisons.map((c, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2.5">
                                                    <div className="font-semibold text-slate-800">{c.order_number}</div>
                                                    <div className="text-[11px] text-slate-500">{c.customer}</div>
                                                </td>
                                                <td className="p-2.5 font-mono text-[11px] text-slate-700 max-w-xs truncate" title={c.address}>
                                                    {c.address}
                                                </td>
                                                <td className="p-2.5 font-bold text-slate-600">RM {c.legacy_rate}</td>
                                                <td className="p-2.5 font-bold text-indigo-700">RM {c.ai_rate}</td>
                                                <td className="p-2.5">
                                                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                                        c.diff_amount === 0 ? 'bg-emerald-50 text-emerald-700' :
                                                        c.diff_amount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                                    }`}>
                                                        {c.diff_amount > 0 ? '+' : ''}{c.diff_amount.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-slate-600 text-[11px]">
                                                    {c.reasoning}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Publish Version Confirmation */}
            {saveModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
                        <h3 className="text-base font-bold text-slate-900 mb-2">🚀 发布新版本运费规则</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            发布后系统将自动生成新版本号，并作为生产环境唯一生效规则。请填写本次修订原因以便追溯。
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                本次变更日志 (Changelog) <span className="text-rose-500">*</span>:
                            </label>
                            <input
                                type="text"
                                value={changelog}
                                onChange={(e) => setChangelog(e.target.value)}
                                placeholder="例如：调整居林四期为 RM150，补充实兆远超点补贴"
                                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                            <button
                                onClick={() => setSaveModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmPublish}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-sm"
                            >
                                {saving ? (
                                    <span>发布中...</span>
                                ) : (
                                    <span>确认发布并生效</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
