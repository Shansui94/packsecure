import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { 
    Calendar, TrendingUp, TrendingDown,
    ChevronLeft, ChevronRight, Search, Download, Loader, 
    PieChart as PieIcon, BarChart2, Cpu, Activity, Info, Globe, 
    FileSpreadsheet, MapPin, Printer, Sparkles, AlertTriangle, 
    CheckCircle2, ShieldCheck, ArrowUpRight, ArrowDownRight, 
    Layers, Factory, Truck, Package, Copy, Check, RefreshCw, 
    X, ShieldAlert, Award, FileText, ChevronDown, FileBarChart
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, 
    LineChart, Line 
} from 'recharts';
import { MACHINES } from '../data/factoryData';
import { determineState } from '../utils/logistics';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

interface ProductionReportsProps {
    user?: any;
    initialTab?: 'overview' | 'trends' | 'production' | 'logistics';
}

export type ReportTab = 'overview' | 'trends' | 'production' | 'logistics';

export interface MonthlyTrendItem {
    month_str: string;
    production_rolls: number;
    scrap_kg: number;
    recycle_kg: number;
    delivered_rolls: number;
    delivered_orders: number;
    delivered_trips: number;
    delivered_drops: number;
    taiping_rolls: number;
    nilai_rolls: number;
    kelantan_rolls: number;
    johor_rolls: number;
    // Derived metrics
    yield_rate?: number;
    scrap_rate?: number;
    balance_ratio?: number;
    net_delta?: number;
    prod_mom_pct?: number | null;
    deliv_mom_pct?: number | null;
    scrap_mom_pct?: number | null;
}

const MONTH_NAMES_ZH = [
    '一月 / January', '二月 / February', '三月 / March', '四月 / April', 
    '五月 / May', '六月 / June', '七月 / July', '八月 / August', 
    '九月 / September', '十月 / October', '十一月 / November', '十二月 / December'
];

const CHART_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // purple-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#14b8a6', // teal-500
    '#f43f5e', // rose-500
    '#6366f1', // indigo-500
    '#a855f7', // purple-400
    '#6b7280'  // gray-500 (for Others)
];

// Helper to identify recycle machines/SKUs whose output is in KG pellets (not rolls)
const isRecycleLog = (machineId?: string, sku?: string) => {
    if (!machineId && !sku) return false;
    const m = (machineId || '').toUpperCase();
    const s = (sku || '').toUpperCase();
    if (m === 'T5-M05' || m.startsWith('T5') || m === 'N3-M03' || m.startsWith('N3') || m === 'J1-M02') return true;
    if (s.startsWith('RM-REC') || s.startsWith('REC-') || s.includes('RECYCLE')) return true;
    return false;
};

// Standard unit roll weight (KG) per SKU based on BUSINESS_RULES.md
const getRollWeightKg = (sku?: string, machineId?: string) => {
    const s = (sku || '').toUpperCase();
    const m = (machineId || '').toUpperCase();
    if (s.includes('-DL-') || s.includes('DOUBLE')) return 5.60;
    if (s.includes('-SL-') || s.includes('SINGLE')) return 3.80;
    if (s.startsWith('SF-') || m.includes('T1-M03') || m.includes('T4-M04') || s.includes('STRETCH')) return 2.20;
    return 4.50; // default bubble wrap standard
};

// Helper to calculate bubble wrap rolls for an order consistently
const calcOrderBubbleWrapRolls = (items: any[] = []): number => {
    let rolls = 0;
    items.forEach((item: any) => {
        const sku = (item.sku || '').toUpperCase();
        const prd = (item.product || item.name || '').toUpperCase();
        // 🔒 仅统计 Bubblewrap 泡膜品类的送货卷数
        const isBubbleWrap = sku.startsWith('BW-') || 
                             /^(SL|DL)-/.test(sku) || 
                             prd.includes('MERAH') || 
                             prd.includes('OREN') || 
                             prd.includes('HITAM') || 
                             prd.includes('BUBBLE');
        
        if (isBubbleWrap) {
            rolls += Number(item.quantity) || 0;
        }
    });
    return rolls;
};

const ProductionReports: React.FC<ProductionReportsProps> = ({ user, initialTab = 'overview' }) => {
    const { t } = useTranslation();
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tableLocation, setTableLocation] = useState<'all' | 'taiping' | 'nilai' | 'kelantan' | 'johor'>('all');
    const [skuNameMap, setSkuNameMap] = useState<Map<string, string>>(new Map());
    const [searchTerm, setSearchTerm] = useState('');
    
    // 4 Top Tabs: overview | trends | production | logistics
    const [activeReportTab, setActiveReportTab] = useState<ReportTab>(initialTab);
    const [driversMap, setDriversMap] = useState<Map<string, string>>(new Map());
    const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

    // Multi-Month Trends (6-Month history)
    const [trendsLoading, setTrendsLoading] = useState(false);
    const [trendsData, setTrendsData] = useState<MonthlyTrendItem[]>([]);

    // AI Executive Briefing Modal
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiReportText, setAiReportText] = useState<string | null>(null);
    const [aiCopied, setAiCopied] = useState(false);

    // Load SKU -> Name mappings
    useEffect(() => {
        const fetchSkus = async () => {
            try {
                const { data } = await supabase.from('master_items_v2').select('sku, name');
                if (data) {
                    const m = new Map<string, string>();
                    data.forEach(s => {
                        if (s.sku && s.name) m.set(s.sku, s.name);
                    });
                    setSkuNameMap(m);
                }
            } catch (err) {
                console.error("Failed to load SKUs:", err);
            }
        };
        fetchSkus();
    }, []);

    // Fetch logs and orders for selected month
    const fetchMonthlyData = async () => {
        setLoading(true);
        try {
            const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDayObj = new Date(selectedYear, selectedMonth, 0);
            const lastDayStr = `${lastDayObj.getFullYear()}-${String(lastDayObj.getMonth() + 1).padStart(2, '0')}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
            
            // ISO range
            const startDateTs = `${firstDay}T00:00:00.000Z`;
            const endDateTs = `${lastDayStr}T23:59:59.999Z`;

            // 1. Fetch Production Logs
            let allLogs: any[] = [];
            let hasMoreLogs = true;
            let offsetLogs = 0;

            while (hasMoreLogs) {
                const { data, error } = await supabase
                    .from('production_logs_v2')
                    .select('log_id, created_at, sku, output_qty, reject_qty, machine_id')
                    .gte('created_at', startDateTs)
                    .lte('created_at', endDateTs)
                    .order('created_at', { ascending: true })
                    .order('log_id', { ascending: true })
                    .range(offsetLogs, offsetLogs + 999);

                if (error) throw error;

                if (data && data.length > 0) {
                    allLogs.push(...data);
                    offsetLogs += 1000;
                    if (data.length < 1000) hasMoreLogs = false;
                } else {
                    hasMoreLogs = false;
                }
            }

            // 2. Fetch Sales Orders (Delivered only) with extra logistics fields
            let allOrders: any[] = [];
            let hasMoreOrders = true;
            let offsetOrders = 0;

            while (hasMoreOrders) {
                const { data, error } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, customer, items, zone, status, order_date, deadline, created_at, delivery_address, driver_id, trip_id, trip_sequence, trip_origin, trip_drop_count')
                    .eq('status', 'Delivered')
                    .or(`order_date.gte.${firstDay},deadline.gte.${firstDay},created_at.gte.${startDateTs}`)
                    .order('created_at', { ascending: true })
                    .order('id', { ascending: true })
                    .range(offsetOrders, offsetOrders + 999);

                if (error) throw error;

                if (data && data.length > 0) {
                    allOrders.push(...data);
                    offsetOrders += 1000;
                    if (data.length < 1000) hasMoreOrders = false;
                } else {
                    hasMoreOrders = false;
                }
            }

            // Precisely filter in JS to selected month/year
            const filteredOrders = allOrders.filter(order => {
                const d = order.order_date || order.deadline || order.created_at;
                if (!d) return false;
                const dateStr = d.slice(0, 7); // YYYY-MM
                return dateStr === `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            });

            // 3. Fetch Driver names
            const [v2Users, pubUsers] = await Promise.all([
                supabase.from('sys_users_v2').select('auth_user_id, name'),
                supabase.from('users_public').select('id, name')
            ]);

            const dm = new Map<string, string>();
            if (v2Users.data) {
                v2Users.data.forEach((u: any) => {
                    if (u.auth_user_id && u.name) dm.set(u.auth_user_id, u.name);
                });
            }
            if (pubUsers.data) {
                pubUsers.data.forEach((u: any) => {
                    if (u.id && u.name) dm.set(u.id, u.name);
                });
            }
            setDriversMap(dm);

            setLogs(allLogs);
            setOrders(filteredOrders);
        } catch (err) {
            console.error("Error fetching monthly production reports:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch 6-Month Trends data from Database RPC
    const fetchTrendsData = useCallback(async () => {
        setTrendsLoading(true);
        try {
            // Compute start date: 5 months before selectedMonth
            const endMonthDate = new Date(selectedYear, selectedMonth, 0);
            const startMonthDate = new Date(selectedYear, selectedMonth - 6, 1);
            
            const startStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${endMonthDate.getFullYear()}-${String(endMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endMonthDate.getDate()).padStart(2, '0')}`;

            const { data, error } = await supabase.rpc('get_monthly_executive_trends', {
                start_date: startStr,
                end_date: endStr
            });

            if (error) {
                console.warn("RPC get_monthly_executive_trends unavailable, using local calculation fallback:", error);
                return;
            }

            if (data && Array.isArray(data)) {
                // Enrich items with MoM% growth and yield rates
                const enriched: MonthlyTrendItem[] = data.map((item: any, idx: number) => {
                    const prodRolls = Number(item.production_rolls) || 0;
                    const scrapKg = Number(item.scrap_kg) || 0;
                    const delivRolls = Number(item.delivered_rolls) || 0;
                    const recKg = Number(item.recycle_kg) || 0;
                    
                    // Good weight approximation (avg 4.5kg per roll)
                    const goodKg = prodRolls * 4.5;
                    const totalMatKg = goodKg + scrapKg;
                    const yieldRate = totalMatKg > 0 ? (goodKg / totalMatKg) * 100 : 100;
                    const scrapRate = totalMatKg > 0 ? (scrapKg / totalMatKg) * 100 : 0;
                    const balanceRatio = prodRolls > 0 ? (delivRolls / prodRolls) * 100 : 0;
                    const netDelta = prodRolls - delivRolls;

                    let prodMomPct: number | null = null;
                    let delivMomPct: number | null = null;
                    let scrapMomPct: number | null = null;

                    if (idx > 0) {
                        const prev = data[idx - 1];
                        const prevProd = Number(prev.production_rolls) || 0;
                        const prevDeliv = Number(prev.delivered_rolls) || 0;
                        const prevScrap = Number(prev.scrap_kg) || 0;

                        if (prevProd > 0) prodMomPct = ((prodRolls - prevProd) / prevProd) * 100;
                        if (prevDeliv > 0) delivMomPct = ((delivRolls - prevDeliv) / prevDeliv) * 100;
                        if (prevScrap > 0) scrapMomPct = ((scrapKg - prevScrap) / prevScrap) * 100;
                    }

                    return {
                        month_str: item.month_str,
                        production_rolls: prodRolls,
                        scrap_kg: scrapKg,
                        recycle_kg: recKg,
                        delivered_rolls: delivRolls,
                        delivered_orders: Number(item.delivered_orders) || 0,
                        delivered_trips: Number(item.delivered_trips) || 0,
                        delivered_drops: Number(item.delivered_drops) || 0,
                        taiping_rolls: Number(item.taiping_rolls) || 0,
                        nilai_rolls: Number(item.nilai_rolls) || 0,
                        kelantan_rolls: Number(item.kelantan_rolls) || 0,
                        johor_rolls: Number(item.johor_rolls) || 0,
                        yield_rate: yieldRate,
                        scrap_rate: scrapRate,
                        balance_ratio: balanceRatio,
                        net_delta: netDelta,
                        prod_mom_pct: prodMomPct,
                        deliv_mom_pct: delivMomPct,
                        scrap_mom_pct: scrapMomPct
                    };
                });

                setTrendsData(enriched);
            }
        } catch (err) {
            console.error("Failed to fetch executive trends:", err);
        } finally {
            setTrendsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => {
        fetchMonthlyData();
        fetchTrendsData();
    }, [selectedMonth, selectedYear, fetchTrendsData]);

    const changeMonth = (offset: number) => {
        let m = selectedMonth + offset;
        let y = selectedYear;
        if (m > 12) { m = 1; y++; }
        if (m < 1) { m = 12; y--; }
        
        // Prevent going into the future
        if (y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth() + 1)) {
            return;
        }

        setSelectedMonth(m);
        setSelectedYear(y);
    };

    // Calculate report aggregates and statistics
    const stats = useMemo(() => {
        let totalOutput = 0;
        let totalRecycleKg = 0;
        let totalGoodWeightKg = 0;
        let totalScrap = 0;
        const skuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const taipingSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const nilaiSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const kelantanSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const johorSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const machineMap = new Map<string, number>();
        const machineScrapMap = new Map<string, number>();
        const dailyMap = new Map<string, number>();
        const factoryMap = new Map<string, number>();

        // Pre-fill daily map for the selected month to ensure all days are plotted
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dailyMap.set(dateKey, 0);
        }

        // Factory breakdown accumulators
        const factoryAggs = {
            taiping: { output: 0, scrap: 0, goodKg: 0, recycleKg: 0 },
            nilai: { output: 0, scrap: 0, goodKg: 0, recycleKg: 0 },
            kelantan: { output: 0, scrap: 0, goodKg: 0, recycleKg: 0 },
            johor: { output: 0, scrap: 0, goodKg: 0, recycleKg: 0 }
        };

        logs.forEach(l => {
            const rawOut = Number(l.output_qty) || 0;
            const scr = Number(l.reject_qty) || 0;
            const isRecycle = isRecycleLog(l.machine_id, l.sku);
            const mId = (l.machine_id || '').toUpperCase();

            // Factory assignment
            let fKey: 'taiping' | 'nilai' | 'kelantan' | 'johor' = 'taiping';
            if (mId.startsWith('N')) fKey = 'nilai';
            else if (mId.startsWith('K')) fKey = 'kelantan';
            else if (mId.startsWith('J')) fKey = 'johor';

            if (isRecycle) {
                totalRecycleKg += rawOut;
                factoryAggs[fKey].recycleKg += rawOut;
            } else {
                const outRolls = Math.round(rawOut);
                const rollWt = getRollWeightKg(l.sku, l.machine_id);
                totalOutput += outRolls;
                const goodKg = outRolls * rollWt;
                totalGoodWeightKg += goodKg;
                factoryAggs[fKey].output += outRolls;
                factoryAggs[fKey].goodKg += goodKg;
            }
            totalScrap += scr;
            factoryAggs[fKey].scrap += scr;

            const out = isRecycle ? Math.round(rawOut * 100) / 100 : Math.round(rawOut);

            // SKU Aggregation (All)
            if (l.sku) {
                const existing = skuMap.get(l.sku);
                if (existing) {
                    existing.output += out;
                    existing.scrap += scr;
                } else {
                    skuMap.set(l.sku, {
                        sku: l.sku,
                        name: skuNameMap.get(l.sku) || l.sku,
                        output: out,
                        scrap: scr
                    });
                }

                // SKU Aggregation by Factory
                const mach = MACHINES.find(m => m.id === l.machine_id);
                const factoryId = mach ? mach.factory_id : 'OPM Lama';
                const targetMap = (factoryId === 'Nilai' || factoryId === 'N1') ? nilaiSkuMap :
                                  (factoryId === 'Kelantan' || factoryId === 'K1') ? kelantanSkuMap :
                                  (factoryId === 'Johor' || factoryId === 'J1') ? johorSkuMap : taipingSkuMap;
                
                const existingFact = targetMap.get(l.sku);
                if (existingFact) {
                    existingFact.output += out;
                    existingFact.scrap += scr;
                } else {
                    targetMap.set(l.sku, {
                        sku: l.sku,
                        name: skuNameMap.get(l.sku) || l.sku,
                        output: out,
                        scrap: scr
                    });
                }
            }

            // Machine Aggregation
            if (l.machine_id) {
                machineMap.set(l.machine_id, (machineMap.get(l.machine_id) || 0) + out);
                if (scr > 0) {
                    machineScrapMap.set(l.machine_id, (machineScrapMap.get(l.machine_id) || 0) + scr);
                }
            }

            // Factory Aggregation
            if (l.machine_id) {
                const mach = MACHINES.find(m => m.id === l.machine_id);
                const factoryId = mach ? mach.factory_id : 'OPM Lama';
                const displayName = (factoryId === 'OPM Lama' || factoryId === 'T1' || factoryId === 'SPD') ? '太平基地 / Taiping (OPM)' :
                                    (factoryId === 'Nilai' || factoryId === 'N1') ? '汝来基地 / Nilai' :
                                    (factoryId === 'Kelantan' || factoryId === 'K1') ? '吉兰丹基地 / Kelantan' :
                                    (factoryId === 'Johor' || factoryId === 'J1') ? '柔佛基地 / Johor' : factoryId;
                factoryMap.set(displayName, (factoryMap.get(displayName) || 0) + out);
            }

            // Daily Aggregation (in local date format YYYY-MM-DD)
            if (l.created_at) {
                const dateObj = new Date(l.created_at);
                const localY = dateObj.getFullYear();
                const localM = String(dateObj.getMonth() + 1).padStart(2, '0');
                const localD = String(dateObj.getDate()).padStart(2, '0');
                const dateKey = `${localY}-${localM}-${localD}`;
                
                if (Number(localM) === selectedMonth && localY === selectedYear) {
                    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + out);
                }
            }
        });

        // Convert Map to list and sort SKUs by output
        const skuList = Array.from(skuMap.values()).sort((a, b) => b.output - a.output);
        const taipingSkuList = Array.from(taipingSkuMap.values()).sort((a, b) => b.output - a.output);
        const nilaiSkuList = Array.from(nilaiSkuMap.values()).sort((a, b) => b.output - a.output);
        const kelantanSkuList = Array.from(kelantanSkuMap.values()).sort((a, b) => b.output - a.output);
        const johorSkuList = Array.from(johorSkuMap.values()).sort((a, b) => b.output - a.output);
        
        // Product proportion data for chart (PieChart)
        let chartSkuData: any[] = [];
        if (totalOutput > 0) {
            let othersOutput = 0;
            skuList.forEach((item, index) => {
                const percent = (item.output / totalOutput) * 100;
                if (percent < 2.5 && index >= 6) {
                    othersOutput += item.output;
                } else {
                    chartSkuData.push({
                        name: item.name.substring(0, 30) + (item.name.length > 30 ? '...' : ''),
                        fullName: item.name,
                        sku: item.sku,
                        value: item.output,
                        percentage: percent.toFixed(1)
                    });
                }
            });

            if (othersOutput > 0) {
                chartSkuData.push({
                    name: '其他产品 / Others',
                    fullName: '其他细分产品 / Other smaller items',
                    sku: 'OTHERS',
                    value: othersOutput,
                    percentage: ((othersOutput / totalOutput) * 100).toFixed(1)
                });
            }
        }

        // Daily trend data for AreaChart
        const trendData = Array.from(dailyMap.entries()).map(([date, output]) => {
            const dayNum = date.split('-')[2];
            return {
                date,
                day: `${dayNum}日`,
                Output: output
            };
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Machine production data for BarChart
        const machineData = Array.from(machineMap.entries()).map(([machine, output]) => ({
            machine,
            Output: output
        })).sort((a, b) => b.Output - a.Output);

        // Machine scrap rankings
        const machineScrapRankings = Array.from(machineScrapMap.entries()).map(([machine, scrapKg]) => ({
            machine,
            scrapKg: Math.round(scrapKg * 10) / 10
        })).sort((a, b) => b.scrapKg - a.scrapKg);

        // Factory production data for chart
        const totalFactoryOutput = Array.from(factoryMap.values()).reduce((sum, v) => sum + v, 0);
        const factoryData = Array.from(factoryMap.entries()).map(([name, value]) => ({
            name,
            value,
            percentage: totalFactoryOutput > 0 ? ((value / totalFactoryOutput) * 100).toFixed(1) : '0'
        })).sort((a, b) => b.value - a.value);

        // Zone delivery data for chart
        const zoneMap = new Map<string, number>();
        orders.forEach(order => {
            let zone = (order.zone || '').trim();
            if (zone === '' || zone.toLowerCase() === 'null') {
                const inferred = order.delivery_address ? determineState(order.delivery_address) : '';
                zone = inferred && inferred !== 'Other' ? inferred.toUpperCase() : '未分配地区 / UNASSIGNED';
            } else {
                zone = zone.toUpperCase();
            }

            let orderQty = 0;
            const items = order.items || [];
            items.forEach((item: any) => {
                orderQty += Number(item.quantity) || 0;
            });

            zoneMap.set(zone, (zoneMap.get(zone) || 0) + orderQty);
        });

        const zoneList = Array.from(zoneMap.entries())
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);

        const totalZoneQty = zoneList.reduce((sum, item) => sum + item.value, 0);

        let chartZoneData: any[] = [];
        if (totalZoneQty > 0) {
            let othersQty = 0;
            zoneList.forEach((item, index) => {
                const percent = (item.value / totalZoneQty) * 100;
                if (percent < 2.5 && index >= 8) {
                    othersQty += item.value;
                } else {
                    chartZoneData.push({
                        name: item.name,
                        value: item.value,
                        percentage: percent.toFixed(1)
                    });
                }
            });

            if (othersQty > 0) {
                chartZoneData.push({
                    name: '其他地区 / Others',
                    value: othersQty,
                    percentage: ((othersQty / totalZoneQty) * 100).toFixed(1)
                });
            }
        }

        const topProduct = skuList.length > 0 ? skuList[0] : null;
        const activeDaysCount = Array.from(dailyMap.values()).filter(qty => qty > 0).length;

        // Material weight calculations
        const totalMaterialKg = totalGoodWeightKg + totalScrap;
        const yieldRate = totalMaterialKg > 0 ? (totalGoodWeightKg / totalMaterialKg) * 100 : 100;
        const scrapRate = totalMaterialKg > 0 ? (totalScrap / totalMaterialKg) * 100 : 0;
        
        // Scrap Financial Impact: Standard resin rate RM 4.80 / kg
        const estimatedScrapCostRm = totalScrap * 4.80;
        const scrapGrade: 'excellent' | 'normal' | 'risk' = 
            scrapRate < 3.0 ? 'excellent' :
            scrapRate <= 5.0 ? 'normal' : 'risk';

        // Factory breakdown enriched
        const factoryBreakdown = {
            taiping: {
                name: '太平基地 (OPM)',
                output: factoryAggs.taiping.output,
                scrap: factoryAggs.taiping.scrap,
                yield: (factoryAggs.taiping.goodKg + factoryAggs.taiping.scrap) > 0 
                    ? (factoryAggs.taiping.goodKg / (factoryAggs.taiping.goodKg + factoryAggs.taiping.scrap)) * 100 
                    : 100,
                recycleKg: factoryAggs.taiping.recycleKg,
                share: totalOutput > 0 ? (factoryAggs.taiping.output / totalOutput) * 100 : 0
            },
            nilai: {
                name: '汝来基地 (Nilai Hub)',
                output: factoryAggs.nilai.output,
                scrap: factoryAggs.nilai.scrap,
                yield: (factoryAggs.nilai.goodKg + factoryAggs.nilai.scrap) > 0 
                    ? (factoryAggs.nilai.goodKg / (factoryAggs.nilai.goodKg + factoryAggs.nilai.scrap)) * 100 
                    : 100,
                recycleKg: factoryAggs.nilai.recycleKg,
                share: totalOutput > 0 ? (factoryAggs.nilai.output / totalOutput) * 100 : 0
            },
            kelantan: {
                name: '吉兰丹基地 (Kelantan)',
                output: factoryAggs.kelantan.output,
                scrap: factoryAggs.kelantan.scrap,
                yield: (factoryAggs.kelantan.goodKg + factoryAggs.kelantan.scrap) > 0 
                    ? (factoryAggs.kelantan.goodKg / (factoryAggs.kelantan.goodKg + factoryAggs.kelantan.scrap)) * 100 
                    : 100,
                recycleKg: factoryAggs.kelantan.recycleKg,
                share: totalOutput > 0 ? (factoryAggs.kelantan.output / totalOutput) * 100 : 0
            },
            johor: {
                name: '柔佛基地 (Johor Hub)',
                output: factoryAggs.johor.output,
                scrap: factoryAggs.johor.scrap,
                yield: (factoryAggs.johor.goodKg + factoryAggs.johor.scrap) > 0 
                    ? (factoryAggs.johor.goodKg / (factoryAggs.johor.goodKg + factoryAggs.johor.scrap)) * 100 
                    : 100,
                recycleKg: factoryAggs.johor.recycleKg,
                share: totalOutput > 0 ? (factoryAggs.johor.output / totalOutput) * 100 : 0
            }
        };

        return {
            totalOutput,
            totalRecycleKg,
            totalGoodWeightKg,
            totalMaterialKg,
            totalScrap,
            scrapRate,
            yieldRate,
            estimatedScrapCostRm,
            scrapGrade,
            skuList,
            taipingSkuList,
            nilaiSkuList,
            kelantanSkuList,
            johorSkuList,
            chartSkuData,
            trendData,
            machineData,
            machineScrapRankings,
            factoryData,
            factoryBreakdown,
            chartZoneData,
            topProduct,
            activeDaysCount
        };
    }, [logs, orders, skuNameMap, selectedMonth, selectedYear]);

    // Active SKU list based on selected location
    const activeSkuList = useMemo(() => {
        if (tableLocation === 'taiping') return stats.taipingSkuList;
        if (tableLocation === 'nilai') return stats.nilaiSkuList;
        if (tableLocation === 'kelantan') return stats.kelantanSkuList;
        if (tableLocation === 'johor') return stats.johorSkuList;
        return stats.skuList;
    }, [stats, tableLocation]);

    // Calculate logistics statistics (1 Trip = 1 Vehicle Run / DO Dispatch)
    const logisticsStats = useMemo(() => {
        const stateMap: Record<string, {
            state: string;
            tripKeys: Set<string>;
            totalDrops: number;
            totalDOs: number;
            totalRolls: number;
            orders: any[];
        }> = {};

        const globalTrips = new Set<string>();
        let totalDrops = 0;
        let totalDOs = 0;
        let totalRolls = 0;

        orders.forEach(order => {
            const addr = order.delivery_address || '';
            const zone = order.zone || '';
            const state = determineState(`${addr} ${zone}`.trim());
            
            const tripId = order.trip_id || order.order_number || String(order.id);
            const dropCount = Math.max(1, Number(order.trip_drop_count) || 1);

            if (!stateMap[state]) {
                stateMap[state] = {
                    state,
                    tripKeys: new Set(),
                    totalDrops: 0,
                    totalDOs: 0,
                    totalRolls: 0,
                    orders: []
                };
            }

            stateMap[state].tripKeys.add(tripId);
            stateMap[state].totalDrops += dropCount;
            stateMap[state].totalDOs += 1;
            stateMap[state].orders.push(order);
            globalTrips.add(tripId);
            totalDrops += dropCount;
            totalDOs += 1;

            const orderRolls = calcOrderBubbleWrapRolls(order.items || []);
            stateMap[state].totalRolls += orderRolls;
            totalRolls += orderRolls;
        });

        const stateList = Object.values(stateMap).map(s => ({
            state: s.state,
            tripsCount: s.tripKeys.size,
            dropsCount: s.totalDrops,
            dosCount: s.totalDOs,
            rollsCount: s.totalRolls,
            orders: s.orders
        })).sort((a, b) => b.tripsCount - a.tripsCount);

        const totalTrips = globalTrips.size;
        const totalStateTrips = stateList.reduce((acc, s) => acc + s.tripsCount, 0);

        const avgRollsPerTripNum = totalTrips > 0 ? totalRolls / totalTrips : 0;
        // Standard lorry capacity = 82 rolls
        const fleetLoadFactor = Math.min(100, Math.round((avgRollsPerTripNum / 82) * 100));

        return {
            stateList,
            totalTrips,
            totalStateTrips,
            totalDrops,
            totalDOs,
            totalRolls,
            avgRollsPerTrip: avgRollsPerTripNum.toFixed(1),
            avgRollsPerTripNum,
            fleetLoadFactor,
            avgDropsPerTrip: totalTrips > 0 ? (totalDrops / totalTrips).toFixed(1) : '0',
            statesCount: stateList.filter(s => s.tripsCount > 0 && s.state !== 'Other').length
        };
    }, [orders]);

    // Executive Supply & Demand Balance (Production vs Delivery)
    const executiveBalance = useMemo(() => {
        const prodRolls = stats.totalOutput;
        const delivRolls = logisticsStats.totalRolls;
        const ratio = prodRolls > 0 ? (delivRolls / prodRolls) * 100 : 0;
        const netDelta = prodRolls - delivRolls; // + net addition to inventory, - net reduction

        let status: 'balanced' | 'depleting' | 'building' = 'balanced';
        let statusText = '产销供求协同平衡';
        let statusBadge = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        let desc = `当月产出与送货交付步调吻合（协同率 ${ratio.toFixed(1)}%）。`;

        if (ratio > 105) {
            status = 'depleting';
            statusText = '交付旺季·库存净去化中';
            statusBadge = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            desc = `出库交付卷数高于当期产出（高出 ${Math.abs(netDelta).toLocaleString()} 卷），正在消耗既有成品库存。`;
        } else if (ratio < 95 && prodRolls > 0) {
            status = 'building';
            statusText = '产能蓄水·成品库存沉淀中';
            statusBadge = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            desc = `当期产出高于出货量（净入库 +${netDelta.toLocaleString()} 卷），为后续大单储备库存。`;
        }

        return {
            prodRolls,
            delivRolls,
            ratio: ratio.toFixed(1),
            ratioNum: ratio,
            netDelta,
            status,
            statusText,
            statusBadge,
            desc
        };
    }, [stats.totalOutput, logisticsStats.totalRolls]);

    // Executive Rule-based Highlights & Action Suggestions
    const executiveInsights = useMemo(() => {
        const wins: string[] = [];
        const alerts: string[] = [];
        const actions: string[] = [];

        // 1. Output & Capacity
        if (stats.totalOutput > 30000) {
            wins.push(`全厂产能处于高位运行，当月合计完成 ${stats.totalOutput.toLocaleString()} 卷生产作业，开工 ${stats.activeDaysCount} 天。`);
        } else if (stats.totalOutput > 0) {
            wins.push(`当月累计产出 ${stats.totalOutput.toLocaleString()} 卷，主力贡献来自 ${stats.topProduct ? stats.topProduct.name : '标准规格'}。`);
        }

        // 2. Yield & Quality
        if (stats.yieldRate >= 98.0) {
            wins.push(`全厂原料良品率达到 ${stats.yieldRate.toFixed(2)}%，处于优等（Grade A）损耗管控区间。`);
        } else if (stats.scrapRate > 4.5) {
            alerts.push(`本月废品损耗达到 ${stats.totalScrap.toLocaleString()} kg（废品率 ${stats.scrapRate.toFixed(2)}%），预估原料损耗成本约 RM ${stats.estimatedScrapCostRm.toLocaleString(undefined, { maximumFractionDigits: 0 })}。`);
            if (stats.machineScrapRankings.length > 0) {
                alerts.push(`损耗主要集中于机台 [${stats.machineScrapRankings[0].machine}]（发生 ${stats.machineScrapRankings[0].scrapKg} kg），建议车间主任安排调刀与机台温控排查。`);
            }
        }

        // 3. Logistics & Fleet Load
        if (logisticsStats.fleetLoadFactor >= 80) {
            wins.push(`车队运力利用率达 ${logisticsStats.fleetLoadFactor}%（平均每车装载 ${logisticsStats.avgRollsPerTrip} 卷 / 标准满载82卷），配载效率极高。`);
        } else if (logisticsStats.totalTrips > 0 && logisticsStats.fleetLoadFactor < 65) {
            alerts.push(`车队单车平均装载量为 ${logisticsStats.avgRollsPerTrip} 卷（满载率 ${logisticsStats.fleetLoadFactor}%），部分车次可能存在轻载或小单出车，可强化并单配载。`);
        }

        // 4. Factory Highlights
        if (stats.factoryBreakdown.johor.output > 0) {
            wins.push(`柔佛基地已顺利投产起量，本月产出 ${stats.factoryBreakdown.johor.output.toLocaleString()} 卷，有效支撑南马配送。`);
        }

        // 5. Actions
        if (executiveBalance.status === 'depleting') {
            actions.push('适当提高太平旧厂与汝来核心挤出机台排班强度，补充热销气泡膜（如 MERAH / OREN）的安全库存。');
        } else if (executiveBalance.status === 'building') {
            actions.push('督促销售与物流协调员关注成品库容占比，适时针对积压品类安排跨仓调拨或促销发货。');
        }
        if (stats.totalRecycleKg > 0) {
            actions.push(`造粒回收产出 ${stats.totalRecycleKg.toLocaleString()} kg 塑料颗粒，建议优先掺混用于单层黑色或二次加工降本。`);
        } else {
            actions.push('监督车间落实边角料收集并安排回收造粒机台（T5/N3/J1）运转，杜绝原材料露天浪费。');
        }

        return { wins, alerts, actions };
    }, [stats, logisticsStats, executiveBalance]);

    // Generate AI Deep Executive Briefing
    const handleGenerateAiBriefing = async () => {
        setIsAiModalOpen(true);
        if (aiReportText) return; // already generated

        setAiLoading(true);
        try {
            const prompt = `
你现在是 Packsecure 工厂集团的资深首席运营官（COO）兼商业分析专家。请根据以下 ${selectedYear}年${selectedMonth}月 的核心月度经营运营数据，为管理层（老板与总经理）撰写一份专业、精炼且具有深度决策价值的【高管经营决策洞察研报】。

【本月核心经营数据】：
- 月度生产总量：${stats.totalOutput.toLocaleString()} 卷（折合净重 ${Math.round(stats.totalGoodWeightKg).toLocaleString()} kg）
- 塑料回收造粒：${stats.totalRecycleKg.toLocaleString()} kg
- 质量良品率：${stats.yieldRate.toFixed(2)}% | 废品产生量：${stats.totalScrap.toLocaleString()} kg（废品率 ${stats.scrapRate.toFixed(2)}%）
- 预估材料损耗金额：约 RM ${stats.estimatedScrapCostRm.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 送货出车总车次：${logisticsStats.totalTrips} 车次 | 送达客户点数：${logisticsStats.totalDrops} 个点
- 配送气泡膜总量：${logisticsStats.totalRolls.toLocaleString()} 卷
- 车队平均每车装载：${logisticsStats.avgRollsPerTrip} 卷（标准满载率约 ${logisticsStats.fleetLoadFactor}%）
- 产销比率：${executiveBalance.ratio}%（状态：${executiveBalance.statusText}）
- 四大基地生产分布：
  * 太平基地：${stats.factoryBreakdown.taiping.output.toLocaleString()} 卷（良品率 ${stats.factoryBreakdown.taiping.yield.toFixed(1)}%）
  * 汝来基地：${stats.factoryBreakdown.nilai.output.toLocaleString()} 卷（良品率 ${stats.factoryBreakdown.nilai.yield.toFixed(1)}%）
  * 吉兰丹基地：${stats.factoryBreakdown.kelantan.output.toLocaleString()} 卷
  * 柔佛基地：${stats.factoryBreakdown.johor.output.toLocaleString()} 卷

【撰写要求】：
1. 语言：中英双语结合，语气客观、专业、干练，聚焦核心矛盾与经营成果。
2. 结构明确（分四大章节）：
   一、本月经营态势总评 (Executive Briefing & Strategic Overview)
   二、产销与交付协同平衡诊断 (Supply-Demand & Fulfillment Balance)
   三、质量、损耗与原料成本控制剖析 (Quality, Scrap & Cost Anomalies)
   四、下月排产与车队调度管理建议 (Actionable Recommendations)
3. 突出数字背后的工厂运营逻辑，指出具体改善抓手。`;

            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    userRole: 'Manager',
                    systemPromptOverride: '你是 Packsecure 工业制造集团的 COO 决策顾问，专注于包装制造全链路降本增效与经营洞察。'
                })
            });

            if (res.ok) {
                const data = await res.json();
                const reply = data.reply || data.message || data.content;
                if (reply) {
                    setAiReportText(reply);
                    return;
                }
            }
            throw new Error('API reply empty');
        } catch (err) {
            console.warn("AI generation failed, using intelligent rule-based narrative:", err);
            // Intelligent Fallback
            const fallbackText = `### 一、本月经营态势总评 (Executive Briefing)
${selectedYear} 年 ${selectedMonth} 月全厂运营保持稳健。全月累计完成气泡膜与缠绕膜生产 **${stats.totalOutput.toLocaleString()} 卷**，开工运转 **${stats.activeDaysCount} 天**；物流车队完成 **${logisticsStats.totalTrips} 车次** 运输，累计送达 **${logisticsStats.totalDrops} 处** 客户点，配送总卷数 **${logisticsStats.totalRolls.toLocaleString()} 卷**。

### 二、产销与交付协同平衡诊断 (Supply-Demand Balance)
全厂产销协同率为 **${executiveBalance.ratio}%**，处于【${executiveBalance.statusText}】。
- 当期制造入库：${stats.totalOutput.toLocaleString()} 卷
- 当期出库配送：${logisticsStats.totalRolls.toLocaleString()} 卷
- 成品库存净变动：${executiveBalance.netDelta > 0 ? `+${executiveBalance.netDelta.toLocaleString()}` : executiveBalance.netDelta.toLocaleString()} 卷。
${executiveBalance.desc}

### 三、质量、损耗与原料成本控制剖析 (Quality & Cost Impact)
- 全厂综合原料良品率：**${stats.yieldRate.toFixed(2)}%**（评级：${stats.scrapGrade === 'excellent' ? '优等 Grade A' : stats.scrapGrade === 'normal' ? '标准 Grade B' : '警戒 Grade C'}）
- 产生废品损耗：**${stats.totalScrap.toLocaleString()} kg**，折合直接原材料损失金额约为 **RM ${stats.estimatedScrapCostRm.toLocaleString(undefined, { maximumFractionDigits: 0 })}**。
- 造粒回收：T5/N3/J1 等造粒机合计完成 **${stats.totalRecycleKg.toLocaleString()} kg** 回收，有效冲抵原料浪费。

### 四、高管决策与下步行动举措 (Actionable Next Steps)
1. **排产协同**：针对核心规格 ${stats.topProduct ? stats.topProduct.name : '主力产品'} 维持充足底仓，避免旺季断货。
2. **损耗攻坚**：车间机修团队应对损耗偏高机台进行吹膜机头与温控传感器专项校验。
3. **车队满载率提升**：当前车队满载率为 **${logisticsStats.fleetLoadFactor}%**，建议物流排单员优先采取多点拼车（Drop Consolidation）策略优化单车收益。`;
            setAiReportText(fallbackText);
        } finally {
            setAiLoading(false);
        }
    };

    // Export comprehensive Executive Workbook (5 Sheets)
    const handleExportExecutiveWorkbook = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Executive Summary
        const summaryData = [
            { '指标科目 (Executive Metric)': '统计周期 / Period', '数值 / Value': `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`, '单位 / Unit': '-' },
            { '指标科目 (Executive Metric)': '制造生产总量 / Total Manufactured', '数值 / Value': stats.totalOutput, '单位 / Unit': 'Rolls (卷)' },
            { '指标科目 (Executive Metric)': '物流出货总量 / Total Delivered', '数值 / Value': logisticsStats.totalRolls, '单位 / Unit': 'Rolls (卷)' },
            { '指标科目 (Executive Metric)': '产销协同率 / Delivery-to-Production Ratio', '数值 / Value': `${executiveBalance.ratio}%`, '单位 / Unit': '%' },
            { '指标科目 (Executive Metric)': '净库存变动 / Net Inventory Delta', '数值 / Value': executiveBalance.netDelta, '单位 / Unit': 'Rolls (卷)' },
            { '指标科目 (Executive Metric)': '供求状态评定 / Flow Status', '数值 / Value': executiveBalance.statusText, '单位 / Unit': '-' },
            { '指标科目 (Executive Metric)': '原料良品率 / Material Yield Rate', '数值 / Value': `${stats.yieldRate.toFixed(2)}%`, '单位 / Unit': '%' },
            { '指标科目 (Executive Metric)': '废品产生总量 / Total Scrap Loss', '数值 / Value': stats.totalScrap, '单位 / Unit': 'kg' },
            { '指标科目 (Executive Metric)': '预估原料损耗成本 / Estimated Scrap Cost', '数值 / Value': `RM ${stats.estimatedScrapCostRm.toFixed(2)}`, '单位 / Unit': 'MYR' },
            { '指标科目 (Executive Metric)': '废塑料回收造粒 / Recycle Pellets Output', '数值 / Value': stats.totalRecycleKg, '单位 / Unit': 'kg' },
            { '指标科目 (Executive Metric)': '出车总车次 / Total Vehicle Trips', '数值 / Value': logisticsStats.totalTrips, '单位 / Unit': 'Trips' },
            { '指标科目 (Executive Metric)': '送达客户点数 / Customer Drops', '数值 / Value': logisticsStats.totalDrops, '单位 / Unit': 'Drops' },
            { '指标科目 (Executive Metric)': '单车平均载卷量 / Avg Rolls per Trip', '数值 / Value': logisticsStats.avgRollsPerTrip, '单位 / Unit': 'Rolls / Trip' },
            { '指标科目 (Executive Metric)': '车队标准满载率 / Fleet Load Factor', '数值 / Value': `${logisticsStats.fleetLoadFactor}%`, '单位 / Unit': '%' },
            { '指标科目 (Executive Metric)': '覆盖服务州属 / Active States Covered', '数值 / Value': logisticsStats.statesCount, '单位 / Unit': 'States' }
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 45 }, { wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, '经营总览_Summary');

        // Sheet 2: 4 Factory Bases Comparison
        const factoryRows = [
            {
                '基地名称 / Factory': stats.factoryBreakdown.taiping.name,
                '生产总量 (卷) / Output (Rolls)': stats.factoryBreakdown.taiping.output,
                '产量占比 (%) / Share': `${stats.factoryBreakdown.taiping.share.toFixed(1)}%`,
                '良品率 (%) / Yield': `${stats.factoryBreakdown.taiping.yield.toFixed(1)}%`,
                '废品产生 (kg) / Scrap': stats.factoryBreakdown.taiping.scrap,
                '塑料造粒 (kg) / Recycle': stats.factoryBreakdown.taiping.recycleKg
            },
            {
                '基地名称 / Factory': stats.factoryBreakdown.nilai.name,
                '生产总量 (卷) / Output (Rolls)': stats.factoryBreakdown.nilai.output,
                '产量占比 (%) / Share': `${stats.factoryBreakdown.nilai.share.toFixed(1)}%`,
                '良品率 (%) / Yield': `${stats.factoryBreakdown.nilai.yield.toFixed(1)}%`,
                '废品产生 (kg) / Scrap': stats.factoryBreakdown.nilai.scrap,
                '塑料造粒 (kg) / Recycle': stats.factoryBreakdown.nilai.recycleKg
            },
            {
                '基地名称 / Factory': stats.factoryBreakdown.kelantan.name,
                '生产总量 (卷) / Output (Rolls)': stats.factoryBreakdown.kelantan.output,
                '产量占比 (%) / Share': `${stats.factoryBreakdown.kelantan.share.toFixed(1)}%`,
                '良品率 (%) / Yield': `${stats.factoryBreakdown.kelantan.yield.toFixed(1)}%`,
                '废品产生 (kg) / Scrap': stats.factoryBreakdown.kelantan.scrap,
                '塑料造粒 (kg) / Recycle': stats.factoryBreakdown.kelantan.recycleKg
            },
            {
                '基地名称 / Factory': stats.factoryBreakdown.johor.name,
                '生产总量 (卷) / Output (Rolls)': stats.factoryBreakdown.johor.output,
                '产量占比 (%) / Share': `${stats.factoryBreakdown.johor.share.toFixed(1)}%`,
                '良品率 (%) / Yield': `${stats.factoryBreakdown.johor.yield.toFixed(1)}%`,
                '废品产生 (kg) / Scrap': stats.factoryBreakdown.johor.scrap,
                '塑料造粒 (kg) / Recycle': stats.factoryBreakdown.johor.recycleKg
            }
        ];
        const wsFactory = XLSX.utils.json_to_sheet(factoryRows);
        wsFactory['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsFactory, '四大基地对比_Factory');

        // Sheet 3: 6-Month Trends (if available)
        if (trendsData.length > 0) {
            const trendsRows = trendsData.map(item => ({
                '月份 / Month': item.month_str,
                '生产卷数 / Output (Rolls)': item.production_rolls,
                '生产环比 / Prod MoM': item.prod_mom_pct != null ? `${item.prod_mom_pct >= 0 ? '+' : ''}${item.prod_mom_pct.toFixed(1)}%` : '-',
                '交付卷数 / Delivered (Rolls)': item.delivered_rolls,
                '交付环比 / Deliv MoM': item.deliv_mom_pct != null ? `${item.deliv_mom_pct >= 0 ? '+' : ''}${item.deliv_mom_pct.toFixed(1)}%` : '-',
                '良品率 / Yield Rate': `${(item.yield_rate || 100).toFixed(1)}%`,
                '废料损耗 (kg) / Scrap': item.scrap_kg,
                '造粒回收 (kg) / Recycle': item.recycle_kg,
                '出车车次 / Trips': item.delivered_trips,
                '送达客户点 / Drops': item.delivered_drops,
                '产销比 / Balance Ratio': `${(item.balance_ratio || 0).toFixed(1)}%`
            }));
            const wsTrends = XLSX.utils.json_to_sheet(trendsRows);
            wsTrends['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, wsTrends, '多月趋势_Trends');
        }

        // Sheet 4: Production SKU Details
        const skuRows = stats.skuList.map((item, idx) => {
            const isRec = isRecycleLog(undefined, item.sku);
            const share = stats.totalOutput > 0 && !isRec ? ((item.output / stats.totalOutput) * 100).toFixed(2) + '%' : '-';
            const itemGoodKg = isRec ? item.output : item.output * getRollWeightKg(item.sku);
            const itemTotalKg = itemGoodKg + item.scrap;
            const yieldPct = itemTotalKg > 0 ? ((itemGoodKg / itemTotalKg) * 100).toFixed(2) + '%' : '100.00%';
            return {
                '序号 / No': idx + 1,
                'SKU 编码 / SKU': item.sku,
                '产品规格名称 / Product Name': item.name,
                '产出总量 (卷/kg) / Output': item.output,
                '废品损耗 (kg) / Scrap': item.scrap,
                '良品率 (重量比) / Yield Rate': yieldPct,
                '全厂产量占比 / Share': share
            };
        });
        const wsSku = XLSX.utils.json_to_sheet(skuRows);
        wsSku['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsSku, '生产明细_Production');

        // Sheet 5: Logistics State Summary
        const logisticsRows = logisticsStats.stateList.map((s, idx) => ({
            '序号 / No': idx + 1,
            '州属 / State': s.state,
            '出车车次 / Trips': s.tripsCount,
            '送达客户点数 / Drop Points': s.dropsCount,
            '送货单数 / Delivery Orders': s.dosCount,
            '送货卷数 / Quantity (Rolls)': s.rollsCount,
            '车次占比 (%)': logisticsStats.totalStateTrips > 0 ? ((s.tripsCount / logisticsStats.totalStateTrips) * 100).toFixed(2) + '%' : '0.00%',
            '送货量占比 (%)': logisticsStats.totalRolls > 0 ? ((s.rollsCount / logisticsStats.totalRolls) * 100).toFixed(2) + '%' : '0.00%'
        }));
        const wsLogistics = XLSX.utils.json_to_sheet(logisticsRows);
        wsLogistics['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsLogistics, '物流出货明细_Logistics');

        const fileName = `Packsecure_Executive_Report_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export logistics monthly report to Excel (.xlsx)
    const handleExportLogistics = () => {
        if (!logisticsStats.stateList.length) {
            alert("该月份暂无物流记录可导出 / No logistics data to export");
            return;
        }

        const summaryRows = logisticsStats.stateList.map((s, index) => {
            const tripShare = logisticsStats.totalStateTrips > 0 ? ((s.tripsCount / logisticsStats.totalStateTrips) * 100).toFixed(2) : '0.00';
            const rollShare = logisticsStats.totalRolls > 0 ? ((s.rollsCount / logisticsStats.totalRolls) * 100).toFixed(2) : '0.00';
            return {
                'No': index + 1,
                '州属 / State': s.state,
                '出车车次 / Trips': s.tripsCount,
                '送达客户点数 / Drop Points': s.dropsCount,
                '送货单数 / Delivery Orders (DOs)': s.dosCount,
                '送货卷数 / Quantity (Rolls)': s.rollsCount,
                '车次占比 / Trip Share (%)': tripShare + '%',
                '送货量占比 / Roll Share (%)': rollShare + '%'
            };
        });

        summaryRows.push({
            'No': 'Total',
            '州属 / State': '总计 / Total',
            '出车车次 / Trips': logisticsStats.totalStateTrips,
            '送达客户点数 / Drop Points': logisticsStats.totalDrops,
            '送货单数 / Delivery Orders (DOs)': logisticsStats.totalDOs,
            '送货卷数 / Quantity (Rolls)': logisticsStats.totalRolls,
            '车次占比 / Trip Share (%)': '100.00%',
            '送货量占比 / Roll Share (%)': '100.00%'
        } as any);

        const detailedRows: any[] = [];
        logisticsStats.stateList.forEach(s => {
            s.orders.forEach(order => {
                const rolls = calcOrderBubbleWrapRolls(order.items || []);
                const driverName = driversMap.get(order.driver_id) || '未分配 / Unassigned';
                const date = (order.order_date || order.deadline || order.created_at || 'N/A').slice(0, 10);
                const drops = Math.max(1, Number(order.trip_drop_count) || 1);

                detailedRows.push({
                    '州属 / State': s.state,
                    '日期 / Date': date,
                    '司机 / Driver': driverName,
                    '送货单号 / DO Number': order.order_number || 'N/A',
                    '送达客户点数 / Drops': drops,
                    '客户名称 / Customer': order.customer || 'N/A',
                    '送货地址 / Delivery Address': order.delivery_address || order.zone || 'N/A',
                    '送货量 / Quantity (Rolls)': rolls
                });
            });
        });

        detailedRows.sort((a, b) => b['日期 / Date'].localeCompare(a['日期 / Date']));

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        const wsDetail = XLSX.utils.json_to_sheet(detailedRows);

        XLSX.utils.book_append_sheet(wb, wsSummary, '州属汇总 / State Summary');
        XLSX.utils.book_append_sheet(wb, wsDetail, '出车明细 / Detailed Trips');

        const fileName = `Laporan_Trip_Negeri_Packsecure_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export monthly report to CSV
    const handleExportCSV = () => {
        if (!activeSkuList.length) return;
        const headers = "SKU,Product Name,Total Produced (Rolls),Total Scrap (Rolls),Net Output,Yield Rate (%),Production Share (%)";
        
        const totalOut = activeSkuList.reduce((sum, item) => sum + item.output, 0);

        const rows = activeSkuList.map(item => {
            const net = item.output - item.scrap;
            const yieldPct = item.output > 0 ? ((net / item.output) * 100).toFixed(2) : '100.00';
            const sharePct = totalOut > 0 ? ((item.output / totalOut) * 100).toFixed(2) : '0.00';
            return `"${item.sku}","${item.name.replace(/"/g, '""')}",${item.output},${item.scrap},${net},${yieldPct},${sharePct}`;
        }).join("\n");

        const csvContent = `${headers}\n${rows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `production_report_${tableLocation}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Search filter SKU table list
    const filteredSkuList = useMemo(() => {
        if (!searchTerm.trim()) return activeSkuList;
        const term = searchTerm.toLowerCase();
        return activeSkuList.filter(item => 
            item.sku.toLowerCase().includes(term) || 
            item.name.toLowerCase().includes(term)
        );
    }, [activeSkuList, searchTerm]);

    // Print Report
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4 md:p-6 min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white pb-24 transition-colors print:p-0 print:bg-white print:text-black">
            {/* Embedded Print Styling */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    nav, aside, header, footer, button, .no-print {
                        display: none !important;
                    }
                    body, .p-4, .md\\:p-6 {
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .print-break-inside-avoid {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                }
            ` }} />

            <div className="max-w-7xl mx-auto space-y-6">

                {/* --- HEADER SECTION --- */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/5 pb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
                                <Sparkles size={11} className="animate-pulse" />
                                EXECUTIVE SUITE
                            </span>
                            <span className="text-slate-400 dark:text-gray-500 text-xs font-mono">
                                PACKSECURE OS · 经营决策舱
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
                            <FileBarChart className="text-blue-600 dark:text-blue-500" size={28} />
                            管理层综合报表
                            <span className="text-xs font-medium text-slate-400 dark:text-gray-500 font-mono hidden sm:inline">
                                Executive Reports & Intelligence
                            </span>
                        </h1>
                    </div>

                    {/* Toolbar Actions & Month Picker */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Month Picker Controls */}
                        <div className="flex items-center gap-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-2xl p-1 shadow-sm backdrop-blur-md">
                            <button 
                                onClick={() => changeMonth(-1)} 
                                title="上一月 / Previous Month"
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all active:scale-95"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            <div className="text-center min-w-[130px] font-sans">
                                <div className="text-xs font-black text-slate-800 dark:text-white">
                                    {MONTH_NAMES_ZH[selectedMonth - 1]}
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 tracking-wider font-bold uppercase">{selectedYear}</div>
                            </div>

                            <button 
                                onClick={() => changeMonth(1)} 
                                disabled={selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()}
                                title="下一月 / Next Month"
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer active:scale-95"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* AI Briefing Button */}
                        <button
                            onClick={handleGenerateAiBriefing}
                            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md shadow-purple-500/10 hover:shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
                        >
                            <Sparkles size={15} />
                            <span>AI 经营简报</span>
                        </button>

                        {/* Export Executive Excel */}
                        <button
                            onClick={handleExportExecutiveWorkbook}
                            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                        >
                            <FileSpreadsheet size={15} />
                            <span>导出高管月报</span>
                        </button>

                        {/* Print / PDF Button */}
                        <button
                            onClick={handlePrint}
                            title="打印汇报 / 另存为 PDF"
                            className="p-2.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-600 dark:text-gray-300 font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                        >
                            <Printer size={16} />
                        </button>
                    </div>
                </div>

                {/* --- 4 EXECUTIVE MAIN TABS --- */}
                <div className="flex bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-1 text-xs shadow-inner overflow-x-auto custom-scrollbar no-print">
                    <button 
                        onClick={() => setActiveReportTab('overview')}
                        className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0 ${activeReportTab === 'overview' ? 'bg-white dark:bg-white/10 text-purple-600 dark:text-purple-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        <Award size={16} />
                        <span>高管经营总览 / Executive Overview</span>
                    </button>
                    <button 
                        onClick={() => setActiveReportTab('trends')}
                        className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0 ${activeReportTab === 'trends' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        <TrendingUp size={16} />
                        <span>多月趋势与环比 / 6-Month Trends & MoM</span>
                    </button>
                    <button 
                        onClick={() => setActiveReportTab('production')}
                        className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0 ${activeReportTab === 'production' ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        <BarChart2 size={16} />
                        <span>生产明细与分析 / Production</span>
                    </button>
                    <button 
                        onClick={() => setActiveReportTab('logistics')}
                        className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0 ${activeReportTab === 'logistics' ? 'bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        <Globe size={16} />
                        <span>物流出车明细 / Logistics</span>
                    </button>
                </div>

                {/* --- CONTENT SECTION --- */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader className="animate-spin text-blue-500" size={40} />
                        <p className="text-slate-500 dark:text-gray-400 font-bold tracking-widest uppercase text-xs animate-pulse">
                            正在聚合全厂高管报表数据... / Loading Executive Data...
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ========================================================================= */}
                        {/* TAB 1: EXECUTIVE OVERVIEW (高管经营总览)                                   */}
                        {/* ========================================================================= */}
                        {activeReportTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                
                                {/* Supply & Demand Banner */}
                                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
                                    <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                                    
                                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${executiveBalance.statusBadge}`}>
                                                    {executiveBalance.statusText}
                                                </span>
                                                <span className="text-xs text-indigo-200/70 font-mono">
                                                    产销平衡协同率: {executiveBalance.ratio}%
                                                </span>
                                            </div>
                                            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                                                全厂产销平衡与库存蓄泄动态
                                            </h2>
                                            <p className="text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                                                {executiveBalance.desc}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shrink-0">
                                            <div className="text-center px-3 border-r border-white/10">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">当月制造入库</div>
                                                <div className="text-xl md:text-2xl font-black text-blue-400 font-mono">
                                                    {stats.totalOutput.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-gray-400">Rolls / 卷</div>
                                            </div>

                                            <div className="text-center px-3 border-r border-white/10">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">当月送货出库</div>
                                                <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono">
                                                    {logisticsStats.totalRolls.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-gray-400">Rolls / 卷</div>
                                            </div>

                                            <div className="text-center px-3">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">净库存蓄泄</div>
                                                <div className={`text-xl md:text-2xl font-black font-mono ${executiveBalance.netDelta >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                    {executiveBalance.netDelta >= 0 ? `+${executiveBalance.netDelta.toLocaleString()}` : executiveBalance.netDelta.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] text-gray-400">Rolls / 卷</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 4 HERO KPI CARDS */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Card 1: Total Output */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                <span>全厂生产制造总量</span>
                                                <Factory size={14} className="text-blue-500" />
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white font-mono">
                                                {stats.totalOutput.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-3 font-semibold flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                                            <TrendingUp size={13} />
                                            <span>净重 {Math.round(stats.totalGoodWeightKg).toLocaleString()} kg · 开工 {stats.activeDaysCount} 天</span>
                                        </div>
                                    </div>

                                    {/* Card 2: Quality & Scrap */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                <span>原料综合良品率</span>
                                                <ShieldCheck size={14} className="text-emerald-500" />
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                {stats.yieldRate.toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-rose-500 mt-3 font-semibold flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                            <span>废损 {stats.totalScrap.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg ({stats.scrapRate.toFixed(1)}%)</span>
                                            <span className="font-mono text-[10px] text-slate-400">~RM {Math.round(stats.estimatedScrapCostRm).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Card 3: Logistics Trips & Volume */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                <span>出车送货车次 / 交付总量</span>
                                                <Truck size={14} className="text-indigo-500" />
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                {logisticsStats.totalTrips} <span className="text-sm font-bold text-slate-400 dark:text-gray-500">车 / {logisticsStats.totalRolls.toLocaleString()} 卷</span>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-3 font-semibold flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                                            <MapPin size={13} />
                                            <span>累计送达 {logisticsStats.totalDrops} 客户点 · 覆 {logisticsStats.statesCount} 州</span>
                                        </div>
                                    </div>

                                    {/* Card 4: Fleet Load Factor */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                <span>车队平均满载率 (标准82卷)</span>
                                                <Award size={14} className="text-amber-500" />
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                                {logisticsStats.fleetLoadFactor}%
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 font-semibold flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                                            <Package size={13} />
                                            <span>平均 {logisticsStats.avgRollsPerTrip} 卷/车 · {logisticsStats.avgDropsPerTrip} 点/车</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 4 FACTORY BASES MATRIX COMPARISON */}
                                <div className="bg-white dark:bg-[#121214] p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                                <Factory className="text-blue-500" size={20} />
                                                四大基地运营矩阵横向对比
                                            </h3>
                                            <p className="text-xs text-slate-400 dark:text-gray-500 font-mono mt-0.5">
                                                TAIPING (OPM) · NILAI · KELANTAN · JOHOR MULTI-BASE BENCHMARK
                                            </p>
                                        </div>
                                        <div className="text-xs font-bold text-slate-500 dark:text-gray-400">
                                            全厂制造合计: <span className="font-mono text-slate-800 dark:text-white font-black">{stats.totalOutput.toLocaleString()}</span> 卷
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Taiping */}
                                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">太平大本营</h4>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full font-mono">
                                                    {stats.factoryBreakdown.taiping.share.toFixed(1)}% 份额
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
                                                    {stats.factoryBreakdown.taiping.output.toLocaleString()} <span className="text-xs font-normal text-slate-400">卷</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${stats.factoryBreakdown.taiping.share}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-xs space-y-1 text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-200 dark:border-white/5">
                                                <div className="flex justify-between">
                                                    <span>原料良品率:</span>
                                                    <span className="font-mono font-bold text-emerald-500">{stats.factoryBreakdown.taiping.yield.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>损耗废料:</span>
                                                    <span className="font-mono text-rose-500">{stats.factoryBreakdown.taiping.scrap} kg</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>塑料造粒:</span>
                                                    <span className="font-mono text-indigo-400">{stats.factoryBreakdown.taiping.recycleKg} kg</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nilai */}
                                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">汝来中心厂</h4>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full font-mono">
                                                    {stats.factoryBreakdown.nilai.share.toFixed(1)}% 份额
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
                                                    {stats.factoryBreakdown.nilai.output.toLocaleString()} <span className="text-xs font-normal text-slate-400">卷</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${stats.factoryBreakdown.nilai.share}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-xs space-y-1 text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-200 dark:border-white/5">
                                                <div className="flex justify-between">
                                                    <span>原料良品率:</span>
                                                    <span className="font-mono font-bold text-emerald-500">{stats.factoryBreakdown.nilai.yield.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>损耗废料:</span>
                                                    <span className="font-mono text-rose-500">{stats.factoryBreakdown.nilai.scrap} kg</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>塑料造粒:</span>
                                                    <span className="font-mono text-indigo-400">{stats.factoryBreakdown.nilai.recycleKg} kg</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Kelantan */}
                                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">吉兰丹东海岸</h4>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full font-mono">
                                                    {stats.factoryBreakdown.kelantan.share.toFixed(1)}% 份额
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
                                                    {stats.factoryBreakdown.kelantan.output.toLocaleString()} <span className="text-xs font-normal text-slate-400">卷</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.factoryBreakdown.kelantan.share}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-xs space-y-1 text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-200 dark:border-white/5">
                                                <div className="flex justify-between">
                                                    <span>原料良品率:</span>
                                                    <span className="font-mono font-bold text-emerald-500">{stats.factoryBreakdown.kelantan.yield.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>损耗废料:</span>
                                                    <span className="font-mono text-rose-500">{stats.factoryBreakdown.kelantan.scrap} kg</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>机台状态:</span>
                                                    <span className="font-mono text-slate-400">K1-M01 / M02</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Johor */}
                                        <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">柔佛南马基地</h4>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full font-mono">
                                                    {stats.factoryBreakdown.johor.share.toFixed(1)}% 份额
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-2xl font-black font-mono text-slate-800 dark:text-white">
                                                    {stats.factoryBreakdown.johor.output.toLocaleString()} <span className="text-xs font-normal text-slate-400">卷</span>
                                                </div>
                                                <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${stats.factoryBreakdown.johor.share}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-xs space-y-1 text-slate-500 dark:text-gray-400 pt-2 border-t border-slate-200 dark:border-white/5">
                                                <div className="flex justify-between">
                                                    <span>原料良品率:</span>
                                                    <span className="font-mono font-bold text-emerald-500">{stats.factoryBreakdown.johor.yield.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>损耗废料:</span>
                                                    <span className="font-mono text-rose-500">{stats.factoryBreakdown.johor.scrap} kg</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>机台状态:</span>
                                                    <span className="font-mono text-slate-400">J1-M01 / M02</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* AI EXECUTIVE INSIGHTS CARD */}
                                <div className="bg-white dark:bg-[#121214] p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                                <Sparkles size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 dark:text-white text-md">
                                                    月度经营智能诊断与管理建议
                                                </h3>
                                                <p className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                                                    AUTOMATED FACTORY OPERATIONS & SUPPLY CHAIN DIAGNOSTICS
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleGenerateAiBriefing}
                                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>查看完整 AI 深度研报</span>
                                            <ArrowUpRight size={14} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                                        {/* Wins */}
                                        <div className="space-y-2.5">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                <CheckCircle2 size={15} /> 经营亮点与突破 (Key Wins)
                                            </h4>
                                            <ul className="space-y-2 text-xs text-slate-600 dark:text-gray-300">
                                                {executiveInsights.wins.map((w, i) => (
                                                    <li key={i} className="flex items-start gap-2 bg-emerald-500/[0.04] p-2.5 rounded-xl border border-emerald-500/10">
                                                        <span className="text-emerald-500 font-bold shrink-0">•</span>
                                                        <span className="leading-relaxed">{w}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Alerts */}
                                        <div className="space-y-2.5">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                <AlertTriangle size={15} /> 重点预警与隐患 (Watchlist)
                                            </h4>
                                            <ul className="space-y-2 text-xs text-slate-600 dark:text-gray-300">
                                                {executiveInsights.alerts.length === 0 ? (
                                                    <li className="bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-slate-400">
                                                        本月未检测到重大高危工艺异常或排产积压。
                                                    </li>
                                                ) : (
                                                    executiveInsights.alerts.map((a, i) => (
                                                        <li key={i} className="flex items-start gap-2 bg-amber-500/[0.04] p-2.5 rounded-xl border border-amber-500/10">
                                                            <span className="text-amber-500 font-bold shrink-0">•</span>
                                                            <span className="leading-relaxed">{a}</span>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        </div>

                                        {/* Actions */}
                                        <div className="space-y-2.5">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                                <Award size={15} /> 高管行动举措 (Action Items)
                                            </h4>
                                            <ul className="space-y-2 text-xs text-slate-600 dark:text-gray-300">
                                                {executiveInsights.actions.map((act, i) => (
                                                    <li key={i} className="flex items-start gap-2 bg-indigo-500/[0.04] p-2.5 rounded-xl border border-indigo-500/10">
                                                        <span className="text-indigo-500 font-bold shrink-0">•</span>
                                                        <span className="leading-relaxed">{act}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Distribution Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Product Share */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[360px]">
                                        <div className="flex items-center justify-between mb-3 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <PieIcon className="text-blue-500" size={18} />
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">主力产品生产占比</h4>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono">TOP PRODUCT PROPORTION</span>
                                        </div>
                                        <div className="flex-1 min-h-0 relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.chartSkuData}
                                                        cx="50%"
                                                        cy="45%"
                                                        innerRadius={55}
                                                        outerRadius={85}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {stats.chartSkuData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any, name: any, props: any) => {
                                                            const percentage = props?.payload?.percentage || '0';
                                                            const fullName = props?.payload?.fullName || name;
                                                            return [`${Number(value).toLocaleString()} 卷 (${percentage}%)`, fullName];
                                                        }}
                                                        contentStyle={{
                                                            backgroundColor: '#1f2937',
                                                            borderColor: '#374151',
                                                            borderRadius: '8px',
                                                            color: '#fff',
                                                            fontSize: '11px',
                                                        }}
                                                    />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        height={45}
                                                        iconType="circle"
                                                        iconSize={8}
                                                        formatter={(value, entry: any) => {
                                                            const percentage = entry?.payload?.percentage || '0';
                                                            return (
                                                                <span className="text-[10px] text-slate-600 dark:text-gray-400 font-medium font-sans">
                                                                    {value} ({percentage}%)
                                                                </span>
                                                            );
                                                        }}
                                                        wrapperStyle={{ bottom: 0, fontSize: '10px' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Destination Zone Quantities */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[360px]">
                                        <div className="flex items-center justify-between mb-3 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <Globe className="text-emerald-500" size={18} />
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">交付区域销量分布 (Top States)</h4>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono">DELIVERIES BY STATE</span>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            {stats.chartZoneData.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-xs text-slate-400">无交付区域数据</div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        layout="vertical"
                                                        data={stats.chartZoneData.slice(0, 7)}
                                                        margin={{ top: 5, right: 20, left: 25, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                        <XAxis type="number" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                                        <YAxis 
                                                            dataKey="name" 
                                                            type="category" 
                                                            stroke="#94a3b8" 
                                                            fontSize={9} 
                                                            tickLine={false}
                                                            width={90} 
                                                        />
                                                        <Tooltip 
                                                            formatter={(value: any, _name: any, props: any) => {
                                                                const percentage = props?.payload?.percentage || '0';
                                                                return [`${Number(value).toLocaleString()} 卷 (${percentage}%)`, '销量'];
                                                            }}
                                                            contentStyle={{
                                                                backgroundColor: '#1f2937',
                                                                borderColor: '#374151',
                                                                borderRadius: '8px',
                                                                color: '#fff',
                                                                fontSize: '11px',
                                                            }}
                                                        />
                                                        <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14}>
                                                            {stats.chartZoneData.slice(0, 7).map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* TAB 2: MULTI-MONTH TRENDS & MOM (多月趋势与环比)                          */}
                        {/* ========================================================================= */}
                        {activeReportTab === 'trends' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                
                                {/* Header explanation */}
                                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-black text-slate-800 dark:text-white text-md flex items-center gap-2">
                                            <TrendingUp className="text-blue-500" size={20} />
                                            近 6 个月全厂产销月度趋势与环比增速 (6-Month Trajectory)
                                        </h3>
                                        <p className="text-xs text-slate-400 dark:text-gray-500 font-mono mt-0.5">
                                            LONGITUDINAL SUPPLY-DEMAND, QUALITY YIELD & FLEET PERFORMANCE
                                        </p>
                                    </div>

                                    <button 
                                        onClick={fetchTrendsData}
                                        disabled={trendsLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-gray-300 transition-all cursor-pointer self-start sm:self-auto"
                                    >
                                        <RefreshCw size={13} className={trendsLoading ? 'animate-spin' : ''} />
                                        <span>刷新多月数据</span>
                                    </button>
                                </div>

                                {trendsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                        <Loader className="animate-spin text-blue-500" size={32} />
                                        <p className="text-xs text-slate-400">正在聚合近 6 个月历史多维指标...</p>
                                    </div>
                                ) : trendsData.length === 0 ? (
                                    <div className="text-center py-20 border border-dashed border-slate-200 dark:border-white/5 rounded-3xl bg-white dark:bg-[#121214] text-slate-400">
                                        暂无多月聚合趋势数据
                                    </div>
                                ) : (
                                    <>
                                        {/* Chart 1: Production vs Delivery BarChart */}
                                        <div className="bg-white dark:bg-[#121214] p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <BarChart2 className="text-blue-500" size={18} />
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                                                        月度制造总量 vs 交付总量对比 (Production vs Delivery by Month)
                                                    </h4>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono">UNIT: ROLLS (卷)</span>
                                            </div>

                                            <div className="h-[360px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={trendsData}
                                                        margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                        <XAxis dataKey="month_str" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                                                        <Tooltip 
                                                            contentStyle={{
                                                                backgroundColor: '#1f2937',
                                                                borderColor: '#374151',
                                                                borderRadius: '8px',
                                                                color: '#fff',
                                                                fontSize: '11px',
                                                            }}
                                                            formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} 卷`, name]}
                                                        />
                                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                                        <Bar name="制造入库总量 (Rolls)" dataKey="production_rolls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                        <Bar name="配送出库总量 (Rolls)" dataKey="delivered_rolls" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Chart 2 & 3: Quality & Fleet Trends */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Quality LineChart */}
                                            <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[340px]">
                                                <div className="flex items-center justify-between mb-3 shrink-0">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldCheck className="text-emerald-500" size={18} />
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">良品率走势 (Yield Rate %)</h4>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">QUALITY TRAJECTORY</span>
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={trendsData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                            <XAxis dataKey="month_str" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                            <YAxis stroke="#94a3b8" fontSize={10} domain={[90, 100]} tickLine={false} />
                                                            <Tooltip 
                                                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                                                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, '良品率']}
                                                            />
                                                            <Line type="monotone" dataKey="yield_rate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Fleet Trips & Drops */}
                                            <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[340px]">
                                                <div className="flex items-center justify-between mb-3 shrink-0">
                                                    <div className="flex items-center gap-2">
                                                        <Truck className="text-indigo-500" size={18} />
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">出车车次与客户点数走势</h4>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">TRIPS & DROPS</span>
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={trendsData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                                                            <defs>
                                                                <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                            <XAxis dataKey="month_str" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                            <Tooltip 
                                                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                                            />
                                                            <Area type="monotone" name="出车车次" dataKey="delivered_trips" stroke="#6366f1" strokeWidth={2} fill="url(#colorTrips)" />
                                                            <Area type="monotone" name="送达点数" dataKey="delivered_drops" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Multi-Month Table with MoM% */}
                                        <div className="bg-white dark:bg-[#121214] p-5 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                                            <h4 className="font-bold text-sm text-slate-800 dark:text-white">
                                                月度环比经营指标对照表 (Month-over-Month Growth Matrix)
                                            </h4>
                                            <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-white/5">
                                                            <th className="p-3 font-bold">月份 / Period</th>
                                                            <th className="p-3 font-bold text-right">生产总量 (Rolls)</th>
                                                            <th className="p-3 font-bold text-right">生产环比 (MoM)</th>
                                                            <th className="p-3 font-bold text-right">交付出货 (Rolls)</th>
                                                            <th className="p-3 font-bold text-right">交付环比 (MoM)</th>
                                                            <th className="p-3 font-bold text-right">原料良品率</th>
                                                            <th className="p-3 font-bold text-right">出车车次</th>
                                                            <th className="p-3 font-bold text-right">客户点数</th>
                                                            <th className="p-3 font-bold text-right">产销协同比</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                                                        {trendsData.map((item) => (
                                                            <tr key={item.month_str} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                                                <td className="p-3 font-bold text-slate-800 dark:text-white">
                                                                    {item.month_str}
                                                                </td>
                                                                <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                                                    {item.production_rolls.toLocaleString()}
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    {item.prod_mom_pct != null ? (
                                                                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${item.prod_mom_pct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'text-rose-500 bg-rose-500/10'}`}>
                                                                            {item.prod_mom_pct >= 0 ? '▲' : '▼'} {Math.abs(item.prod_mom_pct).toFixed(1)}%
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                                    {item.delivered_rolls.toLocaleString()}
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    {item.deliv_mom_pct != null ? (
                                                                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${item.deliv_mom_pct >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'text-rose-500 bg-rose-500/10'}`}>
                                                                            {item.deliv_mom_pct >= 0 ? '▲' : '▼'} {Math.abs(item.deliv_mom_pct).toFixed(1)}%
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="p-3 text-right font-bold text-slate-800 dark:text-white">
                                                                    {(item.yield_rate || 100).toFixed(1)}%
                                                                </td>
                                                                <td className="p-3 text-right text-slate-600 dark:text-gray-300">
                                                                    {item.delivered_trips}
                                                                </td>
                                                                <td className="p-3 text-right text-slate-600 dark:text-gray-300">
                                                                    {item.delivered_drops}
                                                                </td>
                                                                <td className="p-3 text-right font-black text-indigo-500">
                                                                    {(item.balance_ratio || 0).toFixed(1)}%
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* TAB 3: PRODUCTION ANALYSIS (生产明细与分析)                                */}
                        {/* ========================================================================= */}
                        {activeReportTab === 'production' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* KPI METRIC CARDS */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                当月生产总量 / Total Production
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white font-mono">
                                                {Math.round(stats.totalOutput).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-2 font-semibold flex items-center gap-1">
                                            <TrendingUp size={12} /> 卷 / Rolls (总成品计数){stats.totalRecycleKg > 0 ? ` · 造粒: ${stats.totalRecycleKg.toFixed(1)} kg` : ''}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                生产合格率 / Yield Rate
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                {stats.yieldRate.toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="bg-emerald-500 h-1.5 rounded-full" 
                                                    style={{ width: `${Math.min(100, Math.max(0, stats.yieldRate))}%` }} 
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
                                                良品 {Math.round(stats.totalGoodWeightKg).toLocaleString()} kg · 总料 {Math.round(stats.totalMaterialKg).toLocaleString()} kg
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                损耗及废品 / Scrap Volume
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
                                                {stats.totalScrap.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-2 font-semibold flex items-center gap-1">
                                            废品率 / Scrap: {stats.scrapRate.toFixed(2)}%
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                产量最高产品 / Top Product
                                            </div>
                                            <div className="text-sm font-bold text-slate-800 dark:text-white truncate mt-1">
                                                {stats.topProduct ? stats.topProduct.name : '-'}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-gray-600 font-mono mt-2 flex justify-between">
                                            <span>数量: {stats.topProduct ? stats.topProduct.output : 0} 卷</span>
                                            <span>生产天数: {stats.activeDaysCount}天</span>
                                        </div>
                                    </div>
                                </div>

                                {/* VISUAL CHARTS */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[400px]">
                                        <div className="flex items-center gap-2 mb-4 shrink-0">
                                            <PieIcon className="text-blue-500" size={18} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">各 Item 生产数量比例 / Production Proportions</h3>
                                        </div>
                                        <div className="flex-1 min-h-0 relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.chartSkuData}
                                                        cx="50%"
                                                        cy="45%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {stats.chartSkuData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any, name: any, props: any) => {
                                                            const percentage = props?.payload?.percentage || '0';
                                                            const fullName = props?.payload?.fullName || name;
                                                            return [`${Number(value).toLocaleString()} 卷 (${percentage}%)`, fullName];
                                                        }}
                                                        contentStyle={{
                                                            backgroundColor: '#1f2937',
                                                            borderColor: '#374151',
                                                            borderRadius: '8px',
                                                            color: '#fff',
                                                            fontSize: '11px',
                                                        }}
                                                    />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        height={50}
                                                        iconType="circle"
                                                        iconSize={8}
                                                        formatter={(value, entry: any) => {
                                                            const percentage = entry?.payload?.percentage || '0';
                                                            return (
                                                                <span className="text-[10px] text-slate-600 dark:text-gray-400 font-medium font-sans">
                                                                    {value} ({percentage}%)
                                                                </span>
                                                            );
                                                        }}
                                                        wrapperStyle={{ bottom: 0, fontSize: '10px' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[400px]">
                                        <div className="flex items-center gap-2 mb-4 shrink-0">
                                            <Activity className="text-emerald-500" size={18} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">每日生产趋势图 / Daily Output Trend</h3>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                    <Tooltip 
                                                        formatter={(value: any) => [`${value} 卷`, '产量']}
                                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                                    />
                                                    <Area type="monotone" dataKey="Output" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorOutput)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* MACHINE & DETAIL LIST GRID */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[450px]">
                                        <div className="flex items-center gap-2 mb-4 shrink-0">
                                            <Cpu className="text-indigo-500" size={18} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">各设备贡献量 / Machine Productivity</h3>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={stats.machineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                    <XAxis dataKey="machine" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                                                    <Tooltip 
                                                        formatter={(value: any) => [`${value} 卷`, '产量']}
                                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                                                    />
                                                    <Bar dataKey="Output" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                                        {stats.machineData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* SKU Breakdown Table */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col h-[450px]">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Info className="text-slate-400" size={16} />
                                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">产品生产明细清单</h3>
                                                </div>
                                                
                                                <div className="flex bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg p-0.5 text-[10px]">
                                                    <button 
                                                        onClick={() => setTableLocation('all')}
                                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'all' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400'}`}
                                                    >
                                                        全部
                                                    </button>
                                                    <button 
                                                        onClick={() => setTableLocation('taiping')}
                                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'taiping' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400'}`}
                                                    >
                                                        太平
                                                    </button>
                                                    <button 
                                                        onClick={() => setTableLocation('nilai')}
                                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'nilai' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400'}`}
                                                    >
                                                        汝来
                                                    </button>
                                                    <button 
                                                        onClick={() => setTableLocation('kelantan')}
                                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'kelantan' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400'}`}
                                                    >
                                                        吉兰丹
                                                    </button>
                                                    <button 
                                                        onClick={() => setTableLocation('johor')}
                                                        className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'johor' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400'}`}
                                                    >
                                                        柔佛
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" size={14} />
                                                    <input
                                                        type="text" 
                                                        placeholder="搜索 SKU / 产品名称..."
                                                        value={searchTerm} 
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                        className="bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 w-44"
                                                    />
                                                </div>
                                                
                                                <button 
                                                    onClick={handleExportCSV} 
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                                >
                                                    <Download size={14} className="text-emerald-600 dark:text-emerald-400" /> Export CSV
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-white/5 sticky top-0 z-10">
                                                        <th className="p-3 font-bold">SKU 编码</th>
                                                        <th className="p-3 font-bold">产品名称</th>
                                                        <th className="p-3 font-bold text-right">总产量 (卷/KG)</th>
                                                        <th className="p-3 font-bold text-right">损耗废品 (KG)</th>
                                                        <th className="p-3 font-bold text-right">合格率 (重量比)</th>
                                                        <th className="p-3 font-bold text-right">产量占比</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                                    {filteredSkuList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-gray-500">
                                                                未找到匹配的产品信息。
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredSkuList.map(item => {
                                                            const isRec = isRecycleLog(undefined, item.sku);
                                                            const share = stats.totalOutput > 0 && !isRec ? (item.output / stats.totalOutput) * 100 : 0;
                                                            const itemGoodKg = isRec ? item.output : item.output * getRollWeightKg(item.sku);
                                                            const itemTotalKg = itemGoodKg + item.scrap;
                                                            const yieldPct = itemTotalKg > 0 ? (itemGoodKg / itemTotalKg) * 100 : 100;
                                                            return (
                                                                <tr key={item.sku} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                                                                    <td className="p-3 font-mono font-semibold text-slate-600 dark:text-gray-400">
                                                                        {item.sku}
                                                                    </td>
                                                                    <td className="p-3 font-bold text-slate-800 dark:text-white max-w-[200px] truncate" title={item.name}>
                                                                        {item.name}
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                                                                        {item.output.toLocaleString()}{isRec ? ' kg' : ' 卷'}
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono text-rose-500">
                                                                        {item.scrap > 0 ? `-${item.scrap} kg` : '0 kg'}
                                                                    </td>
                                                                    <td className={`p-3 text-right font-mono font-bold ${yieldPct > 98 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                        {yieldPct.toFixed(1)}%
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                                                                        {isRec ? '-' : `${share.toFixed(1)}%`}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* TAB 4: LOGISTICS DELIVERY (物流出车明细)                                  */}
                        {/* ========================================================================= */}
                        {activeReportTab === 'logistics' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Logistics Top Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                出车总车次 / Total Trips
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-500 font-mono">
                                                {logisticsStats.totalTrips.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                            <TrendingUp size={12} className="text-blue-500" /> 全月累计 {logisticsStats.totalTrips} 车次 · 平均 {logisticsStats.avgRollsPerTrip} 卷/车
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                送达客户点数 / Customer Drops
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                {logisticsStats.totalDrops.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                            <MapPin size={12} className="text-emerald-500" /> 全月累计送达 {logisticsStats.totalDrops} 点 · 平均 {logisticsStats.avgDropsPerTrip} 点/车
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                配送卷数总量 / Total Rolls Delivered
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                {logisticsStats.totalRolls.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                            <Activity size={12} className="text-indigo-500" /> 配送的总产品卷数 / Rolls
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                        <div>
                                            <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                                覆盖州属数量 / States Covered
                                            </div>
                                            <div className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-500 font-mono">
                                                {logisticsStats.statesCount.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                            <Globe size={12} className="text-amber-500" /> 马来西亚覆盖州属 (不含Other) / Active States
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Charts and State Table */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Chart: Trips by State */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[450px]">
                                        <div className="flex items-center gap-2 mb-4 shrink-0">
                                            <BarChart2 className="text-blue-500" size={18} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">州属出车分布图 / Trips & Drops by State</h3>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={logisticsStats.stateList.filter(s => s.tripsCount > 0)}
                                                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                    <XAxis 
                                                        dataKey="state" 
                                                        stroke="#94a3b8" 
                                                        fontSize={9} 
                                                        tickLine={false} 
                                                        interval={0}
                                                        angle={-30}
                                                        textAnchor="end"
                                                        height={45}
                                                    />
                                                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: '#1f2937',
                                                            borderColor: '#374151',
                                                            borderRadius: '8px',
                                                            color: '#fff',
                                                            fontSize: '11px',
                                                        }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                                    <Bar name="出车车次 / Trips" dataKey="tripsCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    <Bar name="送达点数 / Drops" dataKey="dropsCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Collapsible State Table */}
                                    <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col h-[450px]">
                                        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <Globe className="text-blue-500" size={18} />
                                                <h3 className="font-bold text-slate-800 dark:text-white text-sm">州属出车与送货单汇总表 / State Summary & DOs</h3>
                                            </div>
                                            <button
                                                onClick={handleExportLogistics}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all cursor-pointer"
                                            >
                                                <Download size={14} /> 导出 Excel
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-white/5 sticky top-0 z-10">
                                                        <th className="p-3 font-bold">州属 / State</th>
                                                        <th className="p-3 font-bold text-right">出车车次</th>
                                                        <th className="p-3 font-bold text-right">送达点数</th>
                                                        <th className="p-3 font-bold text-right">送货单数</th>
                                                        <th className="p-3 font-bold text-right">送达卷数</th>
                                                        <th className="p-3 font-bold text-center">明细</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                                    {logisticsStats.stateList.map(s => {
                                                        const isExpanded = !!expandedStates[s.state];
                                                        return (
                                                            <React.Fragment key={s.state}>
                                                                <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                                                                    <td className="p-3 font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                                        <MapPin size={13} className="text-blue-500 shrink-0" />
                                                                        <span>{s.state}</span>
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                                                        {s.tripsCount}
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                                        {s.dropsCount}
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono text-slate-600 dark:text-gray-300">
                                                                        {s.dosCount}
                                                                    </td>
                                                                    <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                                                                        {s.rollsCount.toLocaleString()} 卷
                                                                    </td>
                                                                    <td className="p-3 text-center">
                                                                        <button
                                                                            onClick={() => setExpandedStates(prev => ({ ...prev, [s.state]: !prev[s.state] }))}
                                                                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                                                                        >
                                                                            <ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                                        </button>
                                                                    </td>
                                                                </tr>

                                                                {isExpanded && (
                                                                    <tr>
                                                                        <td colSpan={6} className="bg-slate-50/50 dark:bg-black/20 p-3">
                                                                            <div className="space-y-2">
                                                                                <div className="text-[11px] font-bold text-slate-500 dark:text-gray-400 mb-1">
                                                                                    {s.state} 配送订单明细 ({s.orders.length} 笔 DO):
                                                                                </div>
                                                                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                                                                    {s.orders.map((ord: any) => {
                                                                                        const rolls = calcOrderBubbleWrapRolls(ord.items || []);
                                                                                        const driverName = driversMap.get(ord.driver_id) || '未分配';
                                                                                        return (
                                                                                            <div key={ord.id} className="text-[11px] flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#18181b] border border-slate-200/60 dark:border-white/5">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="font-mono font-bold text-blue-500">{ord.order_number}</span>
                                                                                                    <span className="text-slate-700 dark:text-gray-200 truncate max-w-[150px]">{ord.customer}</span>
                                                                                                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{ord.delivery_address}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-3 font-mono">
                                                                                                    <span className="text-[10px] bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-slate-500">{driverName}</span>
                                                                                                    <span className="font-bold text-slate-800 dark:text-white">{rolls} 卷</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>

            {/* ========================================================================= */}
            {/* AI EXECUTIVE BRIEFING MODAL (高管智能经营简报弹窗)                        */}
            {/* ========================================================================= */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in no-print">
                    <div className="bg-white dark:bg-[#18181b] text-slate-900 dark:text-white w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-slate-800 dark:text-white">
                                        Packsecure 高管经营决策洞察研报
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 font-mono">
                                        AI EXECUTIVE BRIEFING · {selectedYear}年{selectedMonth}月
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsAiModalOpen(false)}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {aiLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <Loader className="animate-spin text-purple-500" size={36} />
                                    <p className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase animate-pulse">
                                        Gemini 正在推演本月生产损耗、产销平衡与车队效能...
                                    </p>
                                </div>
                            ) : (
                                <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-700 dark:text-gray-200">
                                    {aiReportText}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-400 font-mono">
                                Packsecure OS · Intelligence Engine
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (aiReportText) {
                                            navigator.clipboard.writeText(aiReportText);
                                            setAiCopied(true);
                                            setTimeout(() => setAiCopied(false), 2000);
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
                                >
                                    {aiCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                    <span>{aiCopied ? '已复制研报' : '复制研报文本'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setAiReportText(null);
                                        handleGenerateAiBriefing();
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                    <RefreshCw size={14} />
                                    <span>重新生成</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProductionReports;
