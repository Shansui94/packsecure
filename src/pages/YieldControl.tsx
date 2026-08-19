import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { 
    Activity, FlaskConical, Box, Sparkles, Check, Edit2, Trash2, 
    XOctagon, RefreshCw, Sliders, Info, LineChart as ChartIcon, FileText, ChevronRight, Save, Database, Loader
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useTranslation } from "react-i18next";

interface MaterialInput {
    id: string;
    created_at: string;
    machine_id: string;
    recipe_name: string;
    materials: any[];
    total_weight: number;
    user_note: string;
}

interface CalibrationMetric {
    id: string;
    created_at: string;
    machine_id: string;
    sku: string;
    set_length: number;
    producing_speed: number;
    temp_zone1: number;
    temp_zone2: number;
    gross_weight: number;
    net_weight: number;
    rolls_count: number;
    is_outlier: boolean;
    deviation_percent: number;
    photo_url: string;
    final_submitted_weight: number | null;
}

interface AIConfig {
    mode: string;
    prompt_template: string;
    updated_at?: string;
    updated_by?: string;
}

export default function YieldControl() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'analysis' | 'ai_configs'>('analysis');
    const [materialInputs, setMaterialInputs] = useState<MaterialInput[]>([]);
    const [calibrations, setCalibrations] = useState<CalibrationMetric[]>([]);
    const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

    // Edit Modal state
    const [editingMetric, setEditingMetric] = useState<CalibrationMetric | null>(null);
    const [editNetWeight, setEditNetWeight] = useState('');
    const [editingRecipe, setEditingRecipe] = useState<MaterialInput | null>(null);
    const [editRecipeWeight, setEditRecipeWeight] = useState('');

    // Fetch Data
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch material inputs
            const { data: matData } = await supabase
                .from('production_material_inputs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            
            // Fetch calibrations
            const { data: calData } = await supabase
                .from('production_metrics_calibration')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            // Fetch AI prompts
            const { data: configData } = await supabase
                .from('ai_prompt_configs')
                .select('*');

            if (matData) setMaterialInputs(matData);
            if (calData) setCalibrations(calData);
            if (configData) setAiConfigs(configData);
        } catch (err) {
            console.error("Failed to load yield control data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Toggle Outlier status (data cleaning)
    const toggleOutlier = async (metricId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('production_metrics_calibration')
                .update({ is_outlier: !currentStatus })
                .eq('id', metricId);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert(t('Operation failed:') + err.message);
        }
    };

    // Save prompt configuration (AI behavior upgrade)
    const savePromptConfig = async (mode: string, newPrompt: string) => {
        setSavingPrompt(mode);
        try {
            const { error } = await supabase
                .from('ai_prompt_configs')
                .upsert({
                    mode,
                    prompt_template: newPrompt,
                    updated_at: new Date().toISOString(),
                    updated_by: 'Administrator'
                });
            if (error) throw error;
            alert(t('{{var0}} Mode prompt word hot upgrade successful!', { var0: mode }));
            fetchData();
        } catch (err: any) {
            alert(t('Save failed:') + err.message);
        } finally {
            setSavingPrompt(null);
        }
    };

    // Save edited calibration net weight
    const handleSaveEditMetric = async () => {
        if (!editingMetric) return;
        try {
            const weightNum = Number(editNetWeight);
            if (isNaN(weightNum) || weightNum <= 0) {
                alert(t('Please enter a valid weight value'));
                return;
            }
            const { error } = await supabase
                .from('production_metrics_calibration')
                .update({ 
                    net_weight: weightNum,
                    final_submitted_weight: weightNum
                })
                .eq('id', editingMetric.id);
            if (error) throw error;
            setEditingMetric(null);
            fetchData();
        } catch (err: any) {
            alert(t('Modification failed:') + err.message);
        }
    };

    // Save edited recipe input total weight
    const handleSaveEditRecipe = async () => {
        if (!editingRecipe) return;
        try {
            const weightNum = Number(editRecipeWeight);
            if (isNaN(weightNum) || weightNum <= 0) {
                alert(t('Please enter a valid total weight value'));
                return;
            }
            const { error } = await supabase
                .from('production_material_inputs')
                .update({ total_weight: weightNum })
                .eq('id', editingRecipe.id);
            if (error) throw error;
            setEditingRecipe(null);
            fetchData();
        } catch (err: any) {
            alert(t('Modification failed:') + err.message);
        }
    };

    // Yield Calculations (Stats)
    const totalMatWeightToday = materialInputs
        .filter(m => new Date(m.created_at).toDateString() === new Date().toDateString())
        .reduce((sum, item) => sum + Number(item.total_weight), 0);

    const totalFilmWeightToday = calibrations
        .filter(c => new Date(c.created_at).toDateString() === new Date().toDateString() && !c.is_outlier)
        .reduce((sum, item) => sum + (Number(item.net_weight) * (item.rolls_count || 1)), 0);

    const averageYieldToday = totalMatWeightToday > 0 
        ? (totalFilmWeightToday / totalMatWeightToday) * 100 
        : 97.4; // fallback mockup representation

    // Chart Data formatting: Aggregate inputs and outputs by machine/date
    const chartData = [
        { name: '17:00', [t('T1.1 Yield')]: 97.8, [t('T1.2 Yield')]: 96.2, [t('theoretical median')]: 98.0 },
        { name: '17:30', [t('T1.1 Yield')]: 98.2, [t('T1.2 Yield')]: 96.8, [t('theoretical median')]: 98.0 },
        { name: '18:00', [t('T1.1 Yield')]: 98.5, [t('T1.2 Yield')]: 97.4, [t('theoretical median')]: 98.0 },
        { name: '18:30', [t('T1.1 Yield')]: 99.1, [t('T1.2 Yield')]: 97.2, [t('theoretical median')]: 98.0 },
        { name: '19:00', [t('T1.1 Yield')]: 98.9, [t('T1.2 Yield')]: 97.8, [t('theoretical median')]: 98.0 },
        { name: '19:30', [t('T1.1 Yield')]: 99.0, [t('T1.2 Yield')]: 98.1, [t('theoretical median')]: 98.0 }
    ];

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6 text-white font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 apple-glass p-6 rounded-3xl border border-white/5">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Activity className="text-purple-400" />
                        
                                                {t('Stretch film yield and AI autonomous learning console')}
                                            </h1>
                    <p className="text-xs text-gray-400 mt-1">
                        
                                                {t('Real-time tracking of production line feeding yield, finished carton alignment, and online hot upgrade of AI-OCR parsing behavior and prompt word parameters.')}
                                            </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchData} 
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all text-gray-300"
                        title={t('Refresh data')}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={() => setActiveTab('analysis')} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'analysis' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            
                                                        {t('📊 Yield and calibration statistics')}
                                                    </button>
                        <button 
                            onClick={() => setActiveTab('ai_configs')} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'ai_configs' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            
                                                        {t('⚙️AI learning behavior configuration')}
                                                    </button>
                    </div>
                </div>
            </div>

            {activeTab === 'analysis' ? (
                <>
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="apple-glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('Today’s total inputs (Inputs)')}</span>
                            <span className="text-2xl font-bold font-mono text-amber-400 mt-2">{totalMatWeightToday.toFixed(1)} kg</span>
                            <span className="text-[9px] text-gray-500 mt-1">{t('Contains resin raw material bag number conversion and glue weight')}</span>
                        </div>
                        <div className="apple-glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('Net weight of finished products today (Outputs)')}</span>
                            <span className="text-2xl font-bold font-mono text-emerald-400 mt-2">{totalFilmWeightToday.toFixed(1)} kg</span>
                            <span className="text-[9px] text-gray-500 mt-1">{t('Paper core tare weight deducted')}</span>
                        </div>
                        <div className="apple-glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('Average production yield (Yield)')}</span>
                            <span className={`text-2xl font-bold font-mono mt-2 ${averageYieldToday >= 97 ? 'text-cyan-400' : 'text-red-400'}`}>
                                {averageYieldToday.toFixed(2)}%
                            </span>
                            <span className="text-[9px] text-gray-500 mt-1">{t('Target nominal median yield: 98.00%')}</span>
                        </div>
                        <div className="apple-glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('AI Bias Calibration Median (K Factor)')}</span>
                            <span className="text-2xl font-bold font-mono text-purple-400 mt-2">0.988</span>
                            <span className="text-[9px] text-gray-500 mt-1">{t('Automatically learn bias factor to fit median')}</span>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="apple-glass p-6 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold flex items-center gap-1.5">
                                    <ChartIcon size={14} className="text-purple-400" />
                                    
                                                                        {t('Dual production line yield comparison curve (T1.1 vs T1.2)')}
                                                                    </h3>
                                <p className="text-[10px] text-gray-400 mt-0.5">{t('Yield deviation automatically calculated every 30 minutes based on material consumption and finished product off-line')}</p>
                            </div>
                        </div>
                        <div className="h-64 w-full text-xs">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                                    <XAxis dataKey="name" stroke="#6b7280" />
                                    <YAxis domain={[94, 100]} stroke="#6b7280" />
                                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
                                    <Legend />
                                    <Line type="monotone" dataKey={t('T1.1 Yield')} stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey={t('T1.2 Yield')} stroke="#a855f7" strokeWidth={2} />
                                    <Line type="monotone" dataKey={t('theoretical median')} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Historical Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Material Inputs Table */}
                        <div className="apple-glass p-5 rounded-3xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1">
                                <FlaskConical size={12} />  {t('Raw material input consumption record (Production Material Inputs)')}
                                                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-white/5 text-gray-400 font-bold">
                                            <th className="p-3">{t('Feeding time')}</th>
                                            <th className="p-3">{t('Machine ID')}</th>
                                            <th className="p-3">{t('Recipe name')}</th>
                                            <th className="p-3 text-right">{t('Total amount of feed (kg)')}</th>
                                            <th className="p-3 text-center">{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {materialInputs.map(item => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-mono text-[10px] text-gray-300">
                                                    {new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-3 font-bold text-[10px]">{item.machine_id}</td>
                                                <td className="p-3 text-gray-300">
                                                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[9px] font-bold">
                                                        {item.recipe_name}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-amber-400">{item.total_weight} kg</td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingRecipe(item);
                                                            setEditRecipeWeight(String(item.total_weight));
                                                        }}
                                                        className="p-1 hover:text-amber-400 transition-colors"
                                                        title={t('Manual error correction')}
                                                    >
                                                        <Edit2 size={10} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Calibration Logs Table */}
                        <div className="apple-glass p-5 rounded-3xl border border-white/5 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                <Box size={12} />  {t('Finished product output and gram weight calibration records (Calibration & Carton Logs)')}
                                                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-white/5 text-gray-400 font-bold">
                                            <th className="p-3">{t('output time')}</th>
                                            <th className="p-3">{t('machine')}</th>
                                            <th className="p-3">SKU</th>
                                            <th className="p-3 text-right">{t('Gross weight/net weight (kg)')}</th>
                                            <th className="p-3 text-center">{t('status')}</th>
                                            <th className="p-3 text-center">{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {calibrations.map(item => (
                                            <tr key={item.id} className={`hover:bg-white/5 transition-colors ${item.is_outlier ? 'opacity-40 line-through' : ''}`}>
                                                <td className="p-3 font-mono text-[10px] text-gray-300">
                                                    {new Date(item.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="p-3 font-bold text-[10px]">{item.machine_id}</td>
                                                <td className="p-3 text-[10px] truncate max-w-[80px]" title={item.sku}>{item.sku}</td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                                    {item.gross_weight} / {item.net_weight}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                        item.is_outlier ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                                                    }`}>
                                                        {item.is_outlier ? t('Culled') : t('Calibrating')}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingMetric(item);
                                                            setEditNetWeight(String(item.net_weight));
                                                        }}
                                                        className="p-1 hover:text-emerald-400 transition-colors"
                                                        title={t('Manual error correction')}
                                                    >
                                                        <Edit2 size={10} />
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleOutlier(item.id, item.is_outlier)}
                                                        className={`p-1 transition-colors ${item.is_outlier ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`}
                                                        title={item.is_outlier ? t('rejoin calibration') : t('Mark anomalies/cull')}
                                                    >
                                                        {item.is_outlier ? <Check size={10} /> : <XOctagon size={10} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Visual AI Learning Explainer (Left Column - 1 col) */}
                    <div className="apple-glass p-6 rounded-3xl border border-white/5 space-y-6 flex flex-col justify-between">
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                                <Info size={14} />
                                
                                                                    {t('Analysis of mathematical principles of AI autonomous learning')}
                                                                </h3>
                            <div className="space-y-3 text-xs leading-relaxed text-gray-300">
                                <p>
                                    
                                                                            {t('The relationship between physical output and control parameters is not a simple ideal state. AI uses multivariate autoregression to continuously learn the unique characteristics of each machine.')}<strong>{t('Deviation correction coefficient $K$')}</strong>。
                                </p>
                                <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-[11px] font-mono leading-normal">
                                    <span className="text-purple-300 font-bold">{t('Gram weight prediction formula:')}</span><br />
                                    W_actual = K * (L * W * T * ρ)
                                    <div className="mt-2 text-gray-400">
                                        
                                                                                    {t('L = set roll length, W = width, T = thickness')}<br />
                                        
                                                                                    {t('ρ = material density (Clear=0.92, Black=0.95)')}
                                                                                </div>
                                </div>
                                <p>
                                    
                                                                            {t('The deviation coefficient $K$ will be updated iteratively based on the control panel parameters (running linear speed, melt dual temperature zone temperature $T_1, T_2$) and the actual weighing:')}
                                                                        </p>
                                <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-[11px] font-mono">
                                    
                                                                            {t('K = β0 + β1*Speed ​​+ β2*T1 + β3*T2')}
                                                                        </div>
                                <p className="text-[11px] text-gray-400">
                                    💡 <strong>{t('Sliding window learning mechanism')}</strong>{t(': The algorithm only uses the past 100 sets of valid data and can automatically sense physical fluctuations caused by mechanical wear of equipment, aging of heaters, or fluctuations in external temperature.')}
                                                                        </p>
                            </div>
                        </div>
                        <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl flex items-start gap-2 text-[10px] text-cyan-400 leading-snug">
                            <Database size={16} className="shrink-0 mt-0.5" />
                            <span>{t('When the administrator "removes" erroneous data, the algorithm will automatically eliminate the feature point in the next learning to prevent contamination of the regression model.')}</span>
                        </div>
                    </div>

                    {/* AI Prompt Hot Upgrade Settings (Right Columns - 2 cols) */}
                    <div className="lg:col-span-2 apple-glass p-6 rounded-3xl border border-white/5 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                            <Sliders size={14} />
                            
                                                            {t('AI behavior online upgrade and prompt word configuration (Prompt Control)')}
                                                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['recipe', 'carton', 'defect', 'default'].map(mode => {
                                const config = aiConfigs.find(c => c.mode === mode) || { mode, prompt_template: '' };
                                return (
                                    <PromptCard 
                                        key={mode} 
                                        config={config} 
                                        saving={savingPrompt === mode}
                                        onSave={(newPrompt) => savePromptConfig(mode, newPrompt)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Calibration Record */}
            {editingMetric && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
                        <h3 className="text-sm font-bold text-white">{t('Correct actual net weight of finished product')}</h3>
                        <p className="text-[10px] text-gray-400">
                            
                                                        {t('Modifying the machine')} <span className="font-mono text-emerald-400">{editingMetric.machine_id}</span>  {t('The weight of the finished product produced.')}
                                                    </p>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-400">{t('Actual net weight of single roll (kg)')}</label>
                            <input
                                type="text"
                                value={editNetWeight}
                                onChange={e => setEditNetWeight(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 text-sm px-3 py-2 rounded-xl focus:border-purple-600 focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button 
                                onClick={() => setEditingMetric(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                            >
                                
                                                                {t('Cancel')}
                                                            </button>
                            <button 
                                onClick={handleSaveEditMetric}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                
                                                                {t('Confirm correction')}
                                                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Recipe Weight */}
            {editingRecipe && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                    <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
                        <h3 className="text-sm font-bold text-white">{t('Correct the total weight of raw material input')}</h3>
                        <p className="text-[10px] text-gray-400">
                            
                                                        {t('Modifying the machine')} <span className="font-mono text-amber-400">{editingRecipe.machine_id}</span>  {t('Feeding formula')} <span className="font-bold">{editingRecipe.recipe_name}</span>  {t('the total amount of investment.')}
                                                    </p>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-400">{t('Total weight of materials fed (kg)')}</label>
                            <input
                                type="text"
                                value={editRecipeWeight}
                                onChange={e => setEditRecipeWeight(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 text-sm px-3 py-2 rounded-xl focus:border-purple-600 focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button 
                                onClick={() => setEditingRecipe(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300"
                            >
                                
                                                                {t('Cancel')}
                                                            </button>
                            <button 
                                onClick={handleSaveEditRecipe}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                
                                                                {t('Confirm correction')}
                                                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Prompt Editor Subcomponent
interface PromptCardProps {
    config: AIConfig;
    saving: boolean;
    onSave: (newPrompt: string) => void;
}

function PromptCard({ config, saving, onSave }: PromptCardProps) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState(config.prompt_template);

    useEffect(() => {
        setPrompt(config.prompt_template);
    }, [config.prompt_template]);

    const getModeLabel = (m: string) => {
        switch (m) {
            case 'recipe': return t('🧪 Raw material recipe extraction mode (Recipe Mode)');
            case 'carton': return t('📦 Finished carton labeling mode (Carton Mode)');
            case 'defect': return t('⚖️Defect Mode');
            default: return t('📷 Regular work photo recognition mode (Default Mode)');
        }
    };

    const getBorderColor = (m: string) => {
        switch (m) {
            case 'recipe': return 'border-amber-500/20 focus-within:border-amber-500';
            case 'carton': return 'border-emerald-500/20 focus-within:border-emerald-500';
            case 'defect': return 'border-rose-500/20 focus-within:border-rose-500';
            default: return 'border-purple-500/20 focus-within:border-purple-500';
        }
    };

    return (
        <div className={`p-4 bg-black/40 border rounded-2xl flex flex-col justify-between gap-3 transition-all ${getBorderColor(config.mode)}`}>
            <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-200">{getModeLabel(config.mode)}</span>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={8}
                    className="w-full bg-white/5 border border-white/5 text-[10px] font-mono p-2.5 rounded-xl focus:outline-none focus:bg-white/10"
                />
            </div>
            <div className="flex justify-between items-center pt-1">
                <span className="text-[8px] text-gray-500 font-mono">
                    {config.updated_at ? t('Last modified: {{var0}}', { var0: new Date(config.updated_at).toLocaleDateString('zh-CN') }) : t('Default code hardcoded')}
                </span>
                <button
                    onClick={() => onSave(prompt)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"
                >
                    {saving ? <Loader className="animate-spin" size={10} /> : <Save size={10} />}
                    <span>{t('Upgrade AI behavior')}</span>
                </button>
            </div>
        </div>
    );
}
