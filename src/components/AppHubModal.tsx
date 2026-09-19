import React, { useState } from 'react';
import { 
    X, Search, Pin, PinOff, ExternalLink, RotateCcw, 
    Layers, Eye, EyeOff, HelpCircle
} from 'lucide-react';
import { MODULE_GROUPS, MODULE_REGISTRY, ModuleDefinition, ModuleGroupId } from '../config/modules';
import { useTranslation } from 'react-i18next';

interface AppHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (pageId: string) => void;
    customOverrides: Record<string, boolean>;
    onToggleOverride: (moduleId: string, visible: boolean) => void;
    onResetOverrides: () => void;
    showAllModules: boolean;
    onToggleShowAll: (showAll: boolean) => void;
    hasAccess: (pageId: string) => boolean;
    activePage: string;
}

export const AppHubModal: React.FC<AppHubModalProps> = ({
    isOpen,
    onClose,
    onNavigate,
    customOverrides,
    onToggleOverride,
    onResetOverrides,
    showAllModules,
    onToggleShowAll,
    hasAccess,
    activePage
}) => {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pinned' | 'collapsed'>('all');

    const currentLang = i18n.language || (typeof window !== 'undefined' ? localStorage.getItem('packsecure_lang') : null) || 'zh-CN';

    const getLocalizedTitle = (group: { title: string; titleEn?: string }) => {
        if (currentLang === 'zh-CN') return group.title;
        if (currentLang === 'en') return group.titleEn || group.title;
        const translated = t(group.title);
        if (translated && translated !== group.title) return translated;
        if (group.titleEn) {
            const translatedEn = t(group.titleEn);
            if (translatedEn && translatedEn !== group.titleEn) return translatedEn;
            return group.titleEn;
        }
        return group.title;
    };

    const getLocalizedLabel = (mod: { label: string; labelEn?: string }) => {
        if (currentLang === 'zh-CN') return mod.label;
        if (currentLang === 'en') return mod.labelEn || mod.label;
        const translated = t(mod.label);
        if (translated && translated !== mod.label) return translated;
        if (mod.labelEn) {
            const translatedEn = t(mod.labelEn);
            if (translatedEn && translatedEn !== mod.labelEn) return translatedEn;
            return mod.labelEn;
        }
        return mod.label;
    };

    if (!isOpen) return null;

    // Filter accessible modules
    const accessibleModules = MODULE_REGISTRY.filter(m => hasAccess(m.id));

    // Determine current effective visibility
    const isEffectivePinned = (mod: ModuleDefinition) => {
        if (customOverrides[mod.id] !== undefined) {
            return customOverrides[mod.id];
        }
        if (showAllModules) return true;
        return !mod.hiddenFromNav;
    };

    const filteredModules = accessibleModules.filter(mod => {
        // Group filter
        if (selectedGroup !== 'all' && mod.group !== selectedGroup) return false;

        // Status filter
        const pinned = isEffectivePinned(mod);
        if (filterStatus === 'pinned' && !pinned) return false;
        if (filterStatus === 'collapsed' && pinned) return false;

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchName = mod.label.toLowerCase().includes(q) || (mod.labelEn && mod.labelEn.toLowerCase().includes(q));
            const matchDesc = mod.description && mod.description.toLowerCase().includes(q);
            const matchId = mod.id.toLowerCase().includes(q);
            return matchName || matchDesc || matchId;
        }

        return true;
    });

    const totalCollapsed = accessibleModules.filter(m => !isEffectivePinned(m)).length;
    const totalPinned = accessibleModules.filter(m => isEffectivePinned(m)).length;

    const getGroupBadgeColor = (groupId: ModuleGroupId) => {
        switch (groupId) {
            case 'executive': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'operations': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'inventory': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'logistics': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'organization': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
            case 'productivity': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#0e0e13] border border-white/10 rounded-3xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden relative">
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#121218]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                            <Layers size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                                <span>{t('App Hub & Menu Manager')}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-normal">
                                    {t('Total')} {accessibleModules.length} {t('Total features')}
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('Explore and customize your sidebar, navigate directly to any module.')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Show All Switch */}
                        <button
                            type="button"
                            onClick={() => onToggleShowAll(!showAllModules)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                showAllModules 
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                            }`}
                            title={t('Tile all functions in sidebar')}
                        >
                            {showAllModules ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{showAllModules ? t('Show All Mode: ON') : t('Smart Collapse: ON')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="p-4 border-b border-white/5 bg-[#0a0a0e] flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('Search features, pinyin, English or business description...')}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                filterStatus === 'all' ? 'bg-white/10 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {t('All')} ({accessibleModules.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('pinned')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                filterStatus === 'pinned' ? 'bg-blue-500/20 text-blue-300 shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            <Pin size={12} />
                            <span>{t('Pinned in Sidebar')} ({totalPinned})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterStatus('collapsed')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                filterStatus === 'collapsed' ? 'bg-amber-500/20 text-amber-300 shadow' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            <EyeOff size={12} />
                            <span>{t('Collapsed / Secondary')} ({totalCollapsed})</span>
                        </button>
                    </div>

                    {/* Reset Overrides */}
                    {Object.keys(customOverrides).length > 0 && (
                        <button
                            type="button"
                            onClick={onResetOverrides}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 bg-white/5 hover:bg-white/10 rounded-xl transition border border-white/5 cursor-pointer"
                            title={t('Restore recommended layout')}
                        >
                            <RotateCcw size={12} />
                            <span>{t('Reset to Default')}</span>
                        </button>
                    )}
                </div>

                {/* Group Selector Chips */}
                <div className="px-6 py-2.5 border-b border-white/5 bg-[#09090c] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
                    <button
                        type="button"
                        onClick={() => setSelectedGroup('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer ${
                            selectedGroup === 'all' 
                                ? 'bg-amber-500 text-black shadow' 
                                : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                    >
                        {t('All Groups')}
                    </button>
                    {MODULE_GROUPS.map(g => (
                        <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGroup(g.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer ${
                                selectedGroup === g.id 
                                    ? 'bg-amber-500 text-black shadow' 
                                    : 'bg-white/5 text-gray-400 hover:text-white'
                            }`}
                        >
                            {getLocalizedTitle(g)}
                        </button>
                    ))}
                </div>

                {/* Module Cards Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {filteredModules.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                            <Layers size={40} className="text-gray-600 mb-3" />
                            <p className="font-bold text-sm">{t('No matching features found')}</p>
                            <p className="text-xs mt-1">{t('Try clearing filters or changing search keywords')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredModules.map(mod => {
                                const IconComponent = mod.icon;
                                const isPinned = isEffectivePinned(mod);
                                const isCurrentActive = activePage === mod.id;
                                const groupDef = MODULE_GROUPS.find(g => g.id === mod.group);
                                const localizedLabel = getLocalizedLabel(mod);
                                const subLabel = currentLang === 'zh-CN' ? (mod.labelEn || mod.id) : mod.label;

                                return (
                                    <div
                                        key={mod.id}
                                        className={`group/card relative rounded-2xl border p-4.5 flex flex-col justify-between transition-all duration-200 ${
                                            isCurrentActive
                                                ? 'bg-blue-950/20 border-blue-500/40 shadow-lg shadow-blue-950/30'
                                                : isPinned
                                                    ? 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                                                    : 'bg-amber-950/10 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-950/20'
                                        }`}
                                    >
                                        <div>
                                            {/* Top row: Icon, Name & Status */}
                                            <div className="flex items-start justify-between gap-3 mb-2.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                                        isPinned 
                                                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                                    }`}>
                                                        <IconComponent size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="font-black text-sm text-white tracking-tight">
                                                                {localizedLabel}
                                                            </h3>
                                                            {isCurrentActive && (
                                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title={t('Current page')} />
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 font-medium">
                                                            {subLabel}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Pin/Unpin Toggle Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleOverride(mod.id, !isPinned)}
                                                    title={isPinned ? t('Click to collapse: move to "More Collapsed Features"') : t('Click to pin: keep visible in sidebar')}
                                                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                                        isPinned
                                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30'
                                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/30'
                                                    }`}
                                                >
                                                    {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                                                </button>
                                            </div>

                                            {/* Description */}
                                            <p className="text-xs text-gray-400 line-clamp-2 mb-3 min-h-[32px] leading-relaxed">
                                                {mod.description ? t(mod.description) : t('No description available')}
                                            </p>
                                        </div>

                                        {/* Bottom Action & Meta Row */}
                                        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getGroupBadgeColor(mod.group)}`}>
                                                    {groupDef ? getLocalizedTitle(groupDef) : mod.group}
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                                    isPinned 
                                                        ? 'bg-blue-500/10 text-blue-400' 
                                                        : 'bg-amber-500/10 text-amber-400'
                                                }`}>
                                                    {isPinned ? t('Pinned in Sidebar') : t('Collapsed')}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onNavigate(mod.id);
                                                    onClose();
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-amber-500 hover:text-black transition active:scale-95 cursor-pointer"
                                            >
                                                <span>{t('Launch')}</span>
                                                <ExternalLink size={12} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-white/10 bg-[#09090c] flex items-center justify-between text-xs text-gray-500 shrink-0">
                    <div className="flex items-center gap-2">
                        <HelpCircle size={14} className="text-amber-400" />
                        <span>{t('Tip: Collapsed modules can be expanded anytime from "More Collapsed Features" at sidebar bottom, or pinned here. Press ⌘K to search & jump anytime.')}</span>
                    </div>
                    <div className="font-mono text-[11px]">
                        {t('Currently showing: ')}{filteredModules.length} / {accessibleModules.length}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AppHubModal;
