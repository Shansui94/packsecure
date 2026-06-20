import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { 
    Calendar, TrendingUp, 
    ChevronLeft, ChevronRight, Search, Download, Loader, 
    PieChart as PieIcon, BarChart2, Cpu, Activity, Info, Globe, FileSpreadsheet
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { MACHINES } from '../data/factoryData';
import { determineState } from '../utils/logistics';
import * as XLSX from 'xlsx';

interface ProductionReportsProps {
    user: any;
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

const ProductionReports: React.FC<ProductionReportsProps> = () => {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [tableLocation, setTableLocation] = useState<'all' | 'taiping' | 'nilai'>('all');
    const [skuNameMap, setSkuNameMap] = useState<Map<string, string>>(new Map());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Tab and toggle states for logistics
    const [activeReportTab, setActiveReportTab] = useState<'production' | 'logistics'>('production');
    const [driversMap, setDriversMap] = useState<Map<string, string>>(new Map());
    const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

    // Load SKU -> Name mappings
    useEffect(() => {
        const fetchSkus = async () => {
            try {
                const { data } = await supabase.from('v2_inventory_view').select('sku, name');
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

    // Fetch logs for selected month
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

            // 2. Fetch Sales Orders (exclude Cancelled) with extra logistics fields
            let allOrders: any[] = [];
            let hasMoreOrders = true;
            let offsetOrders = 0;

            while (hasMoreOrders) {
                const { data, error } = await supabase
                    .from('sales_orders')
                    .select('id, order_number, customer, items, zone, status, order_date, deadline, created_at, delivery_address, driver_id, trip_id, trip_sequence, trip_origin, trip_drop_count')
                    .neq('status', 'Cancelled')
                    .or(`order_date.gte.${firstDay},deadline.gte.${firstDay},created_at.gte.${startDateTs}`)
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

            // 3. Fetch Driver names from sys_users_v2 and users_public
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

    useEffect(() => {
        fetchMonthlyData();
    }, [selectedMonth, selectedYear]);

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
        let totalScrap = 0;
        const skuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const taipingSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const nilaiSkuMap = new Map<string, { sku: string; name: string; output: number; scrap: number }>();
        const machineMap = new Map<string, number>();
        const dailyMap = new Map<string, number>();
        const factoryMap = new Map<string, number>();

        // Pre-fill daily map for the selected month to ensure all days are plotted
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dailyMap.set(dateKey, 0);
        }

        logs.forEach(l => {
            const out = Number(l.output_qty) || 0;
            const scr = Number(l.reject_qty) || 0;
            totalOutput += out;
            totalScrap += scr;

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
                const targetMap = factoryId === 'Nilai' ? nilaiSkuMap : taipingSkuMap;
                
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
            }

            // Factory Aggregation
            if (l.machine_id) {
                const mach = MACHINES.find(m => m.id === l.machine_id);
                const factoryId = mach ? mach.factory_id : 'OPM Lama';
                const displayName = factoryId === 'OPM Lama' ? '太平基地 / Taiping (OPM)' : factoryId === 'Nilai' ? '汝来基地 / Nilai' : factoryId;
                factoryMap.set(displayName, (factoryMap.get(displayName) || 0) + out);
            }

            // Daily Aggregation (in local date format YYYY-MM-DD)
            if (l.created_at) {
                const dateObj = new Date(l.created_at);
                const localY = dateObj.getFullYear();
                const localM = String(dateObj.getMonth() + 1).padStart(2, '0');
                const localD = String(dateObj.getDate()).padStart(2, '0');
                const dateKey = `${localY}-${localM}-${localD}`;
                
                // Only sum if it falls in the correct month (edges correction)
                if (Number(localM) === selectedMonth && localY === selectedYear) {
                    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + out);
                }
            }
        });

        // Convert Map to list and sort SKUs by output
        const skuList = Array.from(skuMap.values()).sort((a, b) => b.output - a.output);
        const taipingSkuList = Array.from(taipingSkuMap.values()).sort((a, b) => b.output - a.output);
        const nilaiSkuList = Array.from(nilaiSkuMap.values()).sort((a, b) => b.output - a.output);
        
        // Product proportion data for chart (PieChart)
        // Group items less than 2.5% of total production into "Others"
        let chartSkuData: any[] = [];
        if (totalOutput > 0) {
            let othersOutput = 0;
            let othersScrap = 0;
            
            skuList.forEach((item, index) => {
                const percent = (item.output / totalOutput) * 100;
                // If it is small and not in the top 6, group it into others
                if (percent < 2.5 && index >= 6) {
                    othersOutput += item.output;
                    othersScrap += item.scrap;
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
            let zone = (order.zone || '未分配地区 / Unassigned').trim();
            if (zone === '' || zone.toLowerCase() === 'null') {
                zone = '未分配地区 / Unassigned';
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
                // If not in the top 8 and percentage < 2.5%, group into others
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

        // Find top producing item
        const topProduct = skuList.length > 0 ? skuList[0] : null;

        // Count active days (days with production > 0)
        const activeDaysCount = Array.from(dailyMap.values()).filter(qty => qty > 0).length;

        const scrapRate = totalOutput > 0 ? (totalScrap / totalOutput) * 100 : 0;
        const yieldRate = totalOutput > 0 ? ((totalOutput - totalScrap) / totalOutput) * 100 : 100;

        return {
            totalOutput,
            totalScrap,
            scrapRate,
            yieldRate,
            skuList,
            taipingSkuList,
            nilaiSkuList,
            chartSkuData,
            trendData,
            machineData,
            factoryData,
            chartZoneData,
            topProduct,
            activeDaysCount
        };
    }, [logs, orders, skuNameMap, selectedMonth, selectedYear]);

    // Derive active SKU list based on selected location
    const activeSkuList = useMemo(() => {
        if (tableLocation === 'taiping') return stats.taipingSkuList;
        if (tableLocation === 'nilai') return stats.nilaiSkuList;
        return stats.skuList;
    }, [stats, tableLocation]);

    // Calculate logistics statistics (monthly trips by state)
    const logisticsStats = useMemo(() => {
        const stateMap: Record<string, {
            state: string;
            tripKeys: Set<string>;
            totalDOs: number;
            totalRolls: number;
            orders: any[];
        }> = {};

        const tripDriverDate = new Set<string>();
        let totalDOs = 0;
        let totalRolls = 0;

        orders.forEach(order => {
            const addr = order.delivery_address || '';
            const zone = order.zone || '';
            const state = determineState(`${addr} ${zone}`.trim());
            const date = (order.order_date || order.deadline || order.created_at || '').slice(0, 10);
            const driverId = order.driver_id || 'unassigned';

            const tripKey = `${driverId}_${date}_${state}`;
            const globalTripKey = `${driverId}_${date}`;

            if (!stateMap[state]) {
                stateMap[state] = {
                    state,
                    tripKeys: new Set(),
                    totalDOs: 0,
                    totalRolls: 0,
                    orders: []
                };
            }

            stateMap[state].tripKeys.add(tripKey);
            stateMap[state].totalDOs += 1;
            stateMap[state].orders.push(order);
            tripDriverDate.add(globalTripKey);
            totalDOs += 1;

            let orderRolls = 0;
            const items = order.items || [];
            items.forEach((item: any) => {
                orderRolls += Number(item.quantity) || 0;
            });
            stateMap[state].totalRolls += orderRolls;
            totalRolls += orderRolls;
        });

        const stateList = Object.values(stateMap).map(s => ({
            state: s.state,
            tripsCount: s.tripKeys.size,
            dosCount: s.totalDOs,
            rollsCount: s.totalRolls,
            orders: s.orders
        })).sort((a, b) => b.tripsCount - a.tripsCount);

        return {
            stateList,
            totalTrips: tripDriverDate.size,
            totalDOs,
            totalRolls,
            statesCount: stateList.filter(s => s.tripsCount > 0 && s.state !== 'Other').length
        };
    }, [orders]);

    // Export logistics monthly report to Excel (.xlsx)
    const handleExportLogistics = () => {
        if (!logisticsStats.stateList.length) {
            alert("该月份暂无物流记录可导出 / No logistics data to export");
            return;
        }

        // Sheet 1: State Summary
        const summaryRows = logisticsStats.stateList.map((s, index) => {
            const tripShare = logisticsStats.totalTrips > 0 ? ((s.tripsCount / logisticsStats.totalTrips) * 105 / 1.05).toFixed(2) : '0.00';
            const rollShare = logisticsStats.totalRolls > 0 ? ((s.rollsCount / logisticsStats.totalRolls) * 100).toFixed(2) : '0.00';
            return {
                'No': index + 1,
                '州属 / State': s.state,
                '出车趟数 / Trip Days': s.tripsCount,
                '送货单数 / Delivery Orders (DOs)': s.dosCount,
                '送货卷数 / Quantity (Rolls)': s.rollsCount,
                '出车占比 / Trip Share (%)': tripShare + '%',
                '送货量占比 / Roll Share (%)': rollShare + '%'
            };
        });

        // Add Total Row
        summaryRows.push({
            'No': 'Total',
            '州属 / State': '总计 / Total',
            '出车趟数 / Trip Days': logisticsStats.totalTrips,
            '送货单数 / Delivery Orders (DOs)': logisticsStats.totalDOs,
            '送货卷数 / Quantity (Rolls)': logisticsStats.totalRolls,
            '出车占比 / Trip Share (%)': '100.00%',
            '送货量占比 / Roll Share (%)': '100.00%'
        } as any);

        // Sheet 2: Detailed Trip Log
        const detailedRows: any[] = [];
        logisticsStats.stateList.forEach(s => {
            s.orders.forEach(order => {
                let rolls = 0;
                const items = order.items || [];
                items.forEach((item: any) => { rolls += Number(item.quantity) || 0; });

                const driverName = driversMap.get(order.driver_id) || '未分配 / Unassigned';
                const date = order.order_date || order.deadline || 'N/A';

                detailedRows.push({
                    '州属 / State': s.state,
                    '日期 / Date': date,
                    '司机 / Driver': driverName,
                    '送货单号 / DO Number': order.order_number || 'N/A',
                    '客户名称 / Customer': order.customer || 'N/A',
                    '送货地址 / Delivery Address': order.delivery_address || order.zone || 'N/A',
                    '送货量 / Quantity (Rolls)': rolls
                });
            });
        });

        // Sort details by date descending
        detailedRows.sort((a, b) => b['日期 / Date'].localeCompare(a['日期 / Date']));

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        const wsDetail = XLSX.utils.json_to_sheet(detailedRows);

        XLSX.utils.book_append_sheet(wb, wsSummary, '州属汇总 / State Summary');
        XLSX.utils.book_append_sheet(wb, wsDetail, '出车明细 / Detailed Trips');

        // Column Widths
        wsSummary['!cols'] = [
            { wch: 6 },  // No
            { wch: 20 }, // State
            { wch: 20 }, // Trip Days
            { wch: 20 }, // DOs
            { wch: 20 }, // Rolls
            { wch: 22 }, // Trip Share
            { wch: 22 }  // Roll Share
        ];
        wsDetail['!cols'] = [
            { wch: 15 }, // State
            { wch: 15 }, // Date
            { wch: 20 }, // Driver
            { wch: 22 }, // DO Number
            { wch: 25 }, // Customer
            { wch: 50 }, // Address
            { wch: 15 }  // Rolls
        ];

        const fileName = `Laporan_Trip_Negeri_Packsecure_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
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

    return (
        <div className="p-4 md:p-6 min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white pb-24 transition-colors">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* --- HEADER SECTION --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
                            {activeReportTab === 'production' ? (
                                <>
                                    <BarChart2 className="text-blue-600 dark:text-blue-500" size={28} />
                                    生产报告与分析 / Production Analytics
                                </>
                            ) : (
                                <>
                                    <Globe className="text-blue-600 dark:text-blue-500" size={28} />
                                    物流出车报告 / Logistics Reports
                                </>
                            )}
                        </h1>
                        <p className="text-slate-500 dark:text-gray-500 text-xs font-mono flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            {activeReportTab === 'production' 
                                ? 'MONTHLY PRODUCTION DASHBOARD · 月度生产数据面板' 
                                : 'MONTHLY LOGISTICS DASHBOARD · 月度物流出车面板'}
                        </p>
                    </div>

                    {/* Tab Switcher & Month Picker Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-0.5 text-xs shadow-inner">
                            <button 
                                onClick={() => setActiveReportTab('production')}
                                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeReportTab === 'production' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                <BarChart2 size={16} />
                                生产报告 / Production
                            </button>
                            <button 
                                onClick={() => setActiveReportTab('logistics')}
                                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeReportTab === 'logistics' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                                <Globe size={16} />
                                物流报告 / Logistics
                            </button>
                        </div>

                        <div className="flex items-center gap-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-2xl p-1 shadow-sm backdrop-blur-md">
                            <button 
                                onClick={() => changeMonth(-1)} 
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all active:scale-95"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            
                            <div className="text-center min-w-[150px] font-sans">
                                <div className="text-sm font-black text-slate-800 dark:text-white">
                                    {MONTH_NAMES_ZH[selectedMonth - 1]}
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 tracking-wider font-bold uppercase">{selectedYear}</div>
                            </div>

                            <button 
                                onClick={() => changeMonth(1)} 
                                disabled={selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear()}
                                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-all disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer active:scale-95"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- CONTENT SECTION --- */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader className="animate-spin text-blue-500" size={40} />
                        <p className="text-slate-500 dark:text-gray-400 font-bold tracking-widest uppercase text-xs animate-pulse">
                            正在读取报告数据... / Loading Report Data...
                        </p>
                    </div>
                ) : activeReportTab === 'logistics' ? (
                    orders.length === 0 ? (
                        <div className="text-center py-24 text-slate-400 dark:text-gray-600 border border-dashed border-slate-300 dark:border-white/5 rounded-3xl bg-white dark:bg-[#121214]">
                            <Calendar size={48} className="mx-auto mb-4 opacity-20 text-slate-500" />
                            <p className="font-bold text-lg text-slate-700 dark:text-slate-300">该月份暂无物流出车记录 / No logistics data found</p>
                            <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">请尝试切换其他月份查看物流数据。</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* KPI Metrics Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                            出车总趟数 / Total Trip Days
                                        </div>
                                        <div className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-500 font-mono">
                                            {logisticsStats.totalTrips.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                        <TrendingUp size={12} className="text-blue-500" /> 司机·日期·州属 唯一组合 / Unique Trips
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                            完成送货单数 / Delivery Orders (DOs)
                                        </div>
                                        <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                            {logisticsStats.totalDOs.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-gray-500 mt-2 font-semibold flex items-center gap-1">
                                        <Info size={12} className="text-emerald-500" /> 已配送的送货单总数 / Total DOs
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
                                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">州属出车分布图 / Trips & DOs by State</h3>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={logisticsStats.stateList.filter(s => s.tripsCount > 0)}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                <XAxis dataKey="state" stroke="#94a3b8" fontSize={9} tickLine={false} />
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
                                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                <Bar name="出车趟数 / Trips" dataKey="tripsCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                <Bar name="单数 / DOs" dataKey="dosCount" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Collapsible State Table */}
                                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col h-[450px]">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Globe className="text-blue-500" size={18} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">州属出车与送货明细 / State Log Summary</h3>
                                        </div>
                                        <button
                                            onClick={handleExportLogistics}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-all cursor-pointer"
                                        >
                                            <FileSpreadsheet size={14} /> 导出 Excel / Export Excel
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-white/5 sticky top-0 z-10">
                                                    <th className="p-3 font-bold w-10"></th>
                                                    <th className="p-3 font-bold">州属 / State</th>
                                                    <th className="p-3 font-bold text-right">出车趟数</th>
                                                    <th className="p-3 font-bold text-right">送货单数 (DOs)</th>
                                                    <th className="p-3 font-bold text-right">配送卷数 (Rolls)</th>
                                                    <th className="p-3 font-bold text-right">出车占比</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                                                {logisticsStats.stateList.map(s => {
                                                    const isExpanded = !!expandedStates[s.state];
                                                    const tripShare = logisticsStats.totalTrips > 0 ? (s.tripsCount / logisticsStats.totalTrips) * 100 : 0;
                                                    return (
                                                        <React.Fragment key={s.state}>
                                                            <tr 
                                                                onClick={() => setExpandedStates(prev => ({ ...prev, [s.state]: !prev[s.state] }))}
                                                                className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors cursor-pointer"
                                                            >
                                                                <td className="p-3 text-center text-slate-400">
                                                                    <ChevronRight 
                                                                        size={16} 
                                                                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} 
                                                                    />
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-800 dark:text-white">
                                                                    {s.state}
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                                                                    {s.tripsCount} 趟
                                                                </td>
                                                                <td className="p-3 text-right font-mono text-slate-600 dark:text-gray-400">
                                                                    {s.dosCount} 单
                                                                </td>
                                                                <td className="p-3 text-right font-mono text-slate-600 dark:text-gray-400">
                                                                    {s.rollsCount.toLocaleString()} 卷
                                                                </td>
                                                                <td className="p-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                                                                    {tripShare.toFixed(1)}%
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={6} className="bg-slate-50/50 dark:bg-black/20 p-4">
                                                                        <div className="border border-slate-150 dark:border-white/5 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                            <table className="w-full text-left border-collapse text-[11px]">
                                                                                <thead>
                                                                                    <tr className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold border-b border-slate-200 dark:border-white/5 sticky top-0">
                                                                                        <th className="p-2">日期</th>
                                                                                        <th className="p-2">司机</th>
                                                                                        <th className="p-2">送货单号</th>
                                                                                        <th className="p-2">客户名称</th>
                                                                                        <th className="p-2">详细送货地址</th>
                                                                                        <th className="p-2 text-right">送货卷数</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                                                                    {s.orders.map(order => {
                                                                                        let rolls = 0;
                                                                                        const items = order.items || [];
                                                                                        items.forEach((item: any) => { rolls += Number(item.quantity) || 0; });
                                                                                        const driverName = driversMap.get(order.driver_id) || '未分配 / Unassigned';
                                                                                        const date = (order.order_date || order.deadline || order.created_at || 'N/A').slice(0, 10);
                                                                                        return (
                                                                                            <tr key={order.id} className="hover:bg-slate-200/30 dark:hover:bg-white/[0.02] text-slate-700 dark:text-gray-300">
                                                                                                <td className="p-2 font-mono whitespace-nowrap">{date}</td>
                                                                                                <td className="p-2 font-medium">{driverName}</td>
                                                                                                <td className="p-2 font-mono font-bold text-blue-600 dark:text-blue-400">{order.order_number || 'N/A'}</td>
                                                                                                <td className="p-2 truncate max-w-[120px]" title={order.customer}>{order.customer || 'N/A'}</td>
                                                                                                <td className="p-2 truncate max-w-[200px]" title={order.delivery_address}>{order.delivery_address || order.zone || 'N/A'}</td>
                                                                                                <td className="p-2 text-right font-mono">{rolls}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
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
                    )
                ) : logs.length === 0 ? (
                    /* --- EMPTY STATE --- */
                    <div className="text-center py-24 text-slate-400 dark:text-gray-600 border border-dashed border-slate-300 dark:border-white/5 rounded-3xl bg-white dark:bg-[#121214]">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20 text-slate-500" />
                        <p className="font-bold text-lg text-slate-700 dark:text-slate-300">该月份暂无生产记录 / No logs found</p>
                        <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">请尝试切换其他月份查看生产数据。</p>
                    </div>
                ) : (
                    /* --- REPORT CONTENT --- */
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* --- KPI METRIC CARDS --- */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* Card 1: Total Production */}
                            <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                        当月生产总量 / Total Production
                                    </div>
                                    <div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white font-mono">
                                        {stats.totalOutput.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-2 font-semibold flex items-center gap-1">
                                    <TrendingUp size={12} /> 卷 / Rolls (总计数)
                                </div>
                            </div>

                            {/* Card 2: Yield Rate */}
                            <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                        生产合格率 / Yield Rate
                                    </div>
                                    <div className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                        {stats.yieldRate.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="bg-emerald-500 h-1.5 rounded-full" 
                                            style={{ width: `${stats.yieldRate}%` }} 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Scrap / Rejects */}
                            <div className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-500 dark:text-gray-500 font-black uppercase tracking-wider mb-1">
                                        损耗及废品 / Scrap Volume
                                    </div>
                                    <div className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
                                        {stats.totalScrap.toLocaleString()}
                                    </div>
                                </div>
                                <div className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-2 font-semibold flex items-center gap-1">
                                    废品率 / Scrap: {stats.scrapRate.toFixed(2)}%
                                </div>
                            </div>

                            {/* Card 4: Top SKU / Active Days */}
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

                        {/* --- VISUAL CHARTS SECTION --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Chart 1: Item Production Proportion (Pie Chart) */}
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
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                                                    />
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
                                                wrapperStyle={{
                                                    bottom: 0,
                                                    fontSize: '10px'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Chart 2: Daily Production Trend (Area Chart) */}
                            <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[400px]">
                                <div className="flex items-center gap-2 mb-4 shrink-0">
                                    <Activity className="text-emerald-500" size={18} />
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">每日生产趋势图 / Daily Output Trend</h3>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={stats.trendData}
                                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                        >
                                            <defs>
                                                <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                            <XAxis 
                                                dataKey="day" 
                                                stroke="#94a3b8" 
                                                fontSize={10}
                                                tickLine={false}
                                            />
                                            <YAxis 
                                                stroke="#94a3b8" 
                                                fontSize={10}
                                                tickLine={false}
                                            />
                                            <Tooltip 
                                                formatter={(value: any) => [`${value} 卷`, '产量']}
                                                contentStyle={{
                                                    backgroundColor: '#1f2937',
                                                    borderColor: '#374151',
                                                    borderRadius: '8px',
                                                    color: '#fff',
                                                    fontSize: '11px',
                                                }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="Output" 
                                                stroke="#3b82f6" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorOutput)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* --- REGIONAL & FACTORY ANALYSIS SECTION --- */}
                        <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-md flex items-center gap-2">
                                    <Globe className="text-blue-500" size={20} />
                                    地区与基地 analysis / Regional & Factory Analysis
                                </h3>
                                <p className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">
                                    PRODUCTION BY FACTORY LOCATION & DELIVERY QUANTITY BY DESTINATION ZONE
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Factory Production Proportion (Pie Chart) */}
                                <div className="border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col h-[320px]">
                                    <h4 className="font-bold text-slate-700 dark:text-gray-300 text-xs mb-3 flex items-center gap-1.5">
                                        <Cpu className="text-indigo-400" size={14} />
                                        生产基地产量占比 / Production Share by Factory
                                    </h4>
                                    <div className="flex-1 min-h-0 relative">
                                        {stats.factoryData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400">无基地生产数据 / No factory data</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.factoryData}
                                                        cx="50%"
                                                        cy="45%"
                                                        innerRadius={50}
                                                        outerRadius={80}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {stats.factoryData.map((_, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} 
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any, _name: any, props: any) => {
                                                            const percentage = props?.payload?.percentage || '0';
                                                            return [`${Number(value).toLocaleString()} 卷 (${percentage}%)`, _name];
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
                                                        height={40}
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
                                                        wrapperStyle={{
                                                            bottom: 0,
                                                            fontSize: '10px'
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>

                                {/* Destination Zone Quantities (Horizontal Bar Chart) */}
                                <div className="border border-slate-100 dark:border-white/5 rounded-xl p-4 flex flex-col h-[320px]">
                                    <h4 className="font-bold text-slate-700 dark:text-gray-300 text-xs mb-3 flex items-center gap-1.5">
                                        <TrendingUp className="text-emerald-400" size={14} />
                                        交付区域销量分布 / Delivery Quantity by Destination Zone
                                    </h4>
                                    <div className="flex-1 min-h-0">
                                        {stats.chartZoneData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400">无区域交付数据 / No zone data</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    layout="vertical"
                                                    data={stats.chartZoneData}
                                                    margin={{ top: 5, right: 15, left: 20, bottom: 5 }}
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
                                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14}>
                                                        {stats.chartZoneData.map((_, index) => (
                                                            <Cell 
                                                                key={`cell-${index}`} 
                                                                fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} 
                                                            />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- MACHINE & DETAIL LIST GRID --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Machine Contribution Column */}
                            <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col h-[450px]">
                                <div className="flex items-center gap-2 mb-4 shrink-0">
                                    <Cpu className="text-indigo-500" size={18} />
                                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">各设备贡献量 / Machine Productivity</h3>
                                </div>
                                <div className="flex-1 min-h-0">
                                    {stats.machineData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-xs text-slate-400">无设备数据 / No machine data</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={stats.machineData}
                                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                                                <XAxis 
                                                    dataKey="machine" 
                                                    stroke="#94a3b8" 
                                                    fontSize={9}
                                                    tickLine={false}
                                                />
                                                <YAxis 
                                                    stroke="#94a3b8" 
                                                    fontSize={9}
                                                    tickLine={false}
                                                />
                                                <Tooltip 
                                                 formatter={(value: any) => [`${value} 卷`, '产量']}
                                                 contentStyle={{
                                                     backgroundColor: '#1f2937',
                                                     borderColor: '#374151',
                                                     borderRadius: '8px',
                                                     color: '#fff',
                                                     fontSize: '11px',
                                                 }}
                                             />
                                                <Bar dataKey="Output" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                                    {stats.machineData.map((_, index) => (
                                                        <Cell 
                                                            key={`cell-${index}`} 
                                                            fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} 
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* SKU Details Table (Spans 2 columns on lg) */}
                            <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm lg:col-span-2 flex flex-col h-[450px]">
                                
                                {/* Table Controls */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <Info className="text-slate-400" size={16} />
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">产品生产明细清单 / Product Breakdown</h3>
                                        </div>
                                        
                                        {/* Table Location Tabs */}
                                        <div className="flex bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg p-0.5 text-[10px]">
                                            <button 
                                                onClick={() => setTableLocation('all')}
                                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'all' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                                            >
                                                全部 / All
                                            </button>
                                            <button 
                                                onClick={() => setTableLocation('taiping')}
                                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'taiping' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                                            >
                                                太平 / Taiping
                                            </button>
                                            <button 
                                                onClick={() => setTableLocation('nilai')}
                                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${tableLocation === 'nilai' ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                                            >
                                                汝来 / Nilai
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {/* Search Box */}
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
                                        
                                        {/* CSV Export button */}
                                        <button 
                                            onClick={handleExportCSV} 
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                        >
                                            <Download size={14} className="text-emerald-600 dark:text-emerald-400" /> Export CSV
                                        </button>
                                    </div>
                                </div>

                                {/* Table Box */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-[#18181b] text-slate-500 dark:text-gray-400 text-[10px] uppercase tracking-wider border-b border-slate-200 dark:border-white/5 sticky top-0 z-10">
                                                <th className="p-3 font-bold">SKU 编码</th>
                                                <th className="p-3 font-bold">产品名称</th>
                                                <th className="p-3 font-bold text-right">总产量 (卷)</th>
                                                <th className="p-3 font-bold text-right">废品量 (卷)</th>
                                                <th className="p-3 font-bold text-right">合格率</th>
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
                                                    const share = stats.totalOutput > 0 ? (item.output / stats.totalOutput) * 100 : 0;
                                                    const yieldPct = item.output > 0 ? ((item.output - item.scrap) / item.output) * 100 : 100;
                                                    return (
                                                        <tr key={item.sku} className="hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                                                            <td className="p-3 font-mono font-semibold text-slate-600 dark:text-gray-400">
                                                                {item.sku}
                                                            </td>
                                                            <td className="p-3 font-bold text-slate-800 dark:text-white max-w-[200px] truncate" title={item.name}>
                                                                {item.name}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                                                                {item.output.toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-rose-500">
                                                                {item.scrap > 0 ? `-${item.scrap}` : '0'}
                                                            </td>
                                                            <td className={`p-3 text-right font-mono font-bold ${yieldPct > 98 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                {yieldPct.toFixed(1)}%
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                                                                {share.toFixed(1)}%
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
            </div>
        </div>
    );
};

export default ProductionReports;
