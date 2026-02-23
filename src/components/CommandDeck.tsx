import React, { useMemo } from 'react';
import { Activity, AlertTriangle, Radio, Database } from 'lucide-react';

export const CommandDeck: React.FC<{ totalItems: number; activeTab: string; data: any[] }> = ({ totalItems, activeTab, data }) => {

    // Calculate live stats
    const stats = useMemo(() => {
        if (activeTab === 'items') {
            const missingWeight = data.filter(i => !i.weight_kg).length;
            const missingDims = data.filter(i => !i.pack_dims).length;
            return {
                highlight: missingWeight + missingDims,
                highlightLabel: 'Incomplete Records',
                health: Math.max(0, 100 - ((missingWeight + missingDims) * 2)),
                issues: [
                    { label: 'Missing Weight', count: missingWeight },
                    { label: 'Missing Dimensions', count: missingDims }
                ]
            };
        }
        if (activeTab === 'vehicles') {
            const available = data.filter(v => v.status === 'Available').length;
            const onRoute = data.filter(v => v.status === 'On-Route').length;
            return {
                highlight: available,
                highlightLabel: 'Vehicles Available',
                health: available > 0 ? 100 : 50,
                issues: [
                    { label: 'On Route', count: onRoute },
                    { label: 'Maintenance', count: data.length - available - onRoute }
                ]
            };
        }
        // Default generic
        return {
            highlight: data.length,
            highlightLabel: 'Total Records',
            health: 100,
            issues: []
        };
    }, [data, activeTab]);

    return (
        <div className="flex-1 p-8 overflow-y-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-12">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
                    COMMAND DECK
                </h1>
                <p className="text-gray-500 font-mono">System v6.7 • AI Core Online</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Main Stat */}
                <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Database size={100} />
                    </div>
                    <p className="text-gray-500 font-bold uppercase text-xs mb-2">Active Database</p>
                    <div className="text-5xl font-black text-white">{totalItems}</div>
                    <div className="text-green-400 text-sm font-bold mt-2 flex items-center gap-1">
                        <Activity size={14} /> System Operational
                    </div>
                </div>

                {/* Health / Quality */}
                <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertTriangle size={100} />
                    </div>
                    <p className="text-gray-500 font-bold uppercase text-xs mb-2">Data Health</p>
                    <div className={`text-5xl font-black ${stats.health < 80 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {stats.health}%
                    </div>
                    <div className="text-gray-400 text-sm mt-2">
                        {stats.issues.map((i, idx) => (
                            <span key={idx} className="block">• {i.count} {i.label}</span>
                        ))}
                    </div>
                </div>

                {/* Context Specific */}
                <div className="bg-gray-900/50 border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Radio size={100} />
                    </div>
                    <p className="text-gray-500 font-bold uppercase text-xs mb-2">{stats.highlightLabel}</p>
                    <div className="text-5xl font-black text-cyan-400">{stats.highlight}</div>
                    <div className="text-cyan-600/50 text-xs font-mono mt-2 uppercase">Zone: {activeTab}</div>
                </div>
            </div>

            {/* AI Prompt Hint */}
            <div className="mt-20 text-center">
                <p className="text-gray-600 text-sm mb-4">JARVIS is listening...</p>
                <div className="inline-flex gap-2">
                    {['Show me red items', 'Count active machines', 'Draft new customer', 'Analyze stock'].map((hint, i) => (
                        <span key={i} className="px-3 py-1 rounded-full border border-white/5 bg-white/5 text-xs text-gray-500">
                            "{hint}"
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
