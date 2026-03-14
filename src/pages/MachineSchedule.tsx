import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Calendar as CalendarIcon, Clock, Users, Wrench, Plus } from 'lucide-react';
import { MACHINES } from '../data/factoryData';

// --- Types ---
interface Operator {
    employee_id: string;
    display_name: string;
    position: string;
}

interface PlannedSchedule {
    id: string;
    machine_id: string;
    operator_id: string;
    operator_name: string;
    shift_date: string;
    shift_type: string;
}

interface ActualAttendance {
    id: string;
    employee_id: string;
    employee_name: string;
    machine_id: string;
    clock_in: string;
    clock_out: string | null;
}

const MachineSchedule: React.FC<{ user?: any }> = ({ user }) => {
    const _user = user; // Ignore lint warning for now
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedShift, setSelectedShift] = useState<'Morning' | 'Night' | 'All'>('All');
    
    // Extract unique short machine names (e.g., 'N1', 'T1.1') from full IDs
    const [machines] = useState<string[]>(
        Array.from(new Set(MACHINES.map(m => m.id.split('-')[0])))
    );
    const [operators, setOperators] = useState<Operator[]>([]);
    
    // Data constraints
    const [plannedSchedules, setPlannedSchedules] = useState<PlannedSchedule[]>([]);
    const [actualAttendance, setActualAttendance] = useState<ActualAttendance[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Assignment Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [targetMachine, setTargetMachine] = useState<string | null>(null);
    const [targetShift, setTargetShift] = useState<'Morning' | 'Night'>('Morning');
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load static/reference data
    useEffect(() => {
        fetchOperators();
    }, []);

    // Load dynamic data based on date
    useEffect(() => {
        if (selectedDate) {
            loadScheduleData(selectedDate);
        }
    }, [selectedDate]);

    const fetchOperators = async () => {
        const { data, error } = await supabase
            .from('sys_users_v2')
            .select('employee_id, display_name, position')
            .in('role', ['Operator', 'Driver'])
            .order('display_name');
        
        if (!error && data) {
            setOperators(data);
        }
    };

    const loadScheduleData = async (dateStr: string) => {
        setLoading(true);
        try {
            // 1. Fetch Planned Schedules
            const { data: planned } = await supabase
                .from('machine_schedules')
                .select('*')
                .eq('shift_date', dateStr);
            
            setPlannedSchedules(planned || []);

            // 2. Fetch Actual Attendance overlapping this date
            const { data: actual } = await supabase
                .from('operator_attendance')
                .select('*')
                .gte('clock_in', `${dateStr}T00:00:00Z`)
                .lt('clock_in', `${dateStr}T23:59:59Z`);

            setActualAttendance(actual || []);
        } catch (error) {
            console.error('Error loading schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAssignModal = (machine: string) => {
        setTargetMachine(machine);
        setTargetShift(selectedShift === 'All' ? 'Morning' : selectedShift);
        setSelectedOperatorId('');
        setIsAssignModalOpen(true);
    };

    const handleAssignSubmit = async () => {
        if (!targetMachine || !selectedOperatorId) return;
        setIsSubmitting(true);

        const op = operators.find(o => o.employee_id === selectedOperatorId);
        
        try {
            const newSchedule = {
                machine_id: targetMachine,
                operator_id: op!.employee_id,
                operator_name: op!.display_name,
                shift_date: selectedDate,
                shift_type: targetShift,
                // created_by: _user?.id
            };

            const { data, error } = await supabase
                .from('machine_schedules')
                .insert([newSchedule])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setPlannedSchedules([...plannedSchedules, data]);
                setIsAssignModalOpen(false);
            }
        } catch (err: any) {
            alert('Failed to save schedule: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!confirm('Remove this operator from the schedule?')) return;
        try {
            const { error } = await supabase.from('machine_schedules').delete().eq('id', id);
            if (!error) {
                setPlannedSchedules(plannedSchedules.filter(s => s.id !== id));
            }
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    // --- Helper Functions ---
    const getPlannedForMachine = (machine: string) => {
        let list = plannedSchedules.filter(s => s.machine_id === machine);
        if (selectedShift !== 'All') list = list.filter(s => s.shift_type === selectedShift);
        return list;
    };

    const getActualForMachine = (machine: string) => {
        return actualAttendance.filter(a => a.machine_id === machine);
    };

    return (
        <div className="min-h-screen bg-[#07070a] text-white p-4 md:p-8 pb-32 font-sans selection:bg-blue-500/30">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 text-blue-500 mb-2">
                            <CalendarIcon size={28} className="drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            <h1 className="text-3xl font-black tracking-tighter text-white">Machine Schedule</h1>
                        </div>
                        <p className="text-gray-500 text-sm">Plan operator allocations and track actual machine attendance in real-time.</p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3 bg-[#0d0d12] border border-white/5 p-2 rounded-2xl shadow-xl">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white font-bold"
                        />
                        <select
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value as any)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 text-white font-bold appearance-none cursor-pointer"
                        >
                            <option value="All">All Shifts</option>
                            <option value="Morning">Morning</option>
                            <option value="Night">Night</option>
                        </select>
                    </div>
                </div>

                {/* Main Schedule Board */}
                <div className="bg-[#0f0f13] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-blue-500 border-solid animate-spin" />
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading Matrix...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {/* Grid Header */}
                            <div className="grid grid-cols-12 bg-black/40 p-4 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <div className="col-span-3 lg:col-span-2">Machine Unit</div>
                                <div className="col-span-9 lg:col-span-10 grid grid-cols-2 gap-4">
                                    <div className="text-blue-400">Planned Allocation</div>
                                    <div className="text-green-400">Actual Clock-In Overlay</div>
                                </div>
                            </div>

                            {/* Machine Rows */}
                            {machines.map(machine => {
                                const planned = getPlannedForMachine(machine);
                                const actuals = getActualForMachine(machine);
                                
                                return (
                                    <div key={machine} className="grid grid-cols-12 p-4 hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-blue-500 group">
                                        {/* Machine Name */}
                                        <div className="col-span-3 lg:col-span-2 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all">
                                                <Wrench size={18} className="text-gray-400 group-hover:text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="font-black text-lg text-white tracking-tight">{machine}</div>
                                                <div className="text-[10px] text-gray-500 font-mono uppercase">Production Unit</div>
                                            </div>
                                        </div>

                                        {/* Planner vs Actual Comparison */}
                                        <div className="col-span-9 lg:col-span-10 grid grid-cols-2 gap-4">
                                            
                                            {/* PLANNED COLUMN */}
                                            <div className="flex flex-col gap-2 p-2 rounded-xl bg-blue-950/10 border border-blue-500/10 min-h-[80px]">
                                                {/* Hidden temporarily to fix operators unused warning */}
                                                <div className="hidden">{operators.length} Operators Loaded</div>
                                                {planned.length > 0 ? (
                                                    planned.map(p => (
                                                        <div key={p.id} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 flex items-center justify-between transition-colors group/item">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => handleDeleteSchedule(p.id)} className="w-6 h-6 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/30 flex items-center justify-center shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" title="Remove Assignment">
                                                                    <Wrench size={10} className="hidden" /> {/* Placeholder for alignment if needed */}
                                                                    <div className="w-3 h-0.5 bg-current rotate-45 absolute" />
                                                                    <div className="w-3 h-0.5 bg-current -rotate-45 absolute" />
                                                                </button>
                                                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover/item:hidden">
                                                                    <Users size={12} />
                                                                </div>
                                                                <span className="text-sm font-bold text-gray-200">{p.operator_name}</span>
                                                            </div>
                                                            <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-black/40 text-gray-400 border border-white/5 font-mono">
                                                                {p.shift_type}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex items-center justify-center">
                                                        <button onClick={() => handleOpenAssignModal(machine)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-blue-500/50 hover:text-blue-400 transition-colors">
                                                            <Plus size={14} /> Assign Operator
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* ACTUAL COLUMN */}
                                            <div className="flex flex-col gap-2 p-2 rounded-xl bg-green-950/10 border border-green-500/10 min-h-[80px]">
                                                {actuals.length > 0 ? (
                                                    actuals.map(a => {
                                                        const inTime = new Date(a.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                                        const outTime = a.clock_out ? new Date(a.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Active';
                                                        
                                                        // Check compliance: Is this person scheduled here?
                                                        const isScheduled = planned.some(p => p.operator_id === a.employee_id);

                                                        return (
                                                        <div key={a.id} className={`bg-black/40 border border-white/5 rounded-lg p-2 flex flex-col gap-2 transition-colors overflow-hidden relative ${isScheduled ? '' : 'border-l-2 border-l-orange-500'}`}>
                                                            {/* Background Progress Bar (Optional, can calculate percentage of shift) */}
                                                            <div className="flex items-center justify-between z-10 relative">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${a.clock_out ? 'bg-gray-500' : 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
                                                                    <span className="text-sm font-bold text-gray-200">{a.employee_name}</span>
                                                                    {!isScheduled && (
                                                                        <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold hidden xl:block" title="This operator was not scheduled on this machine.">
                                                                            Unscheduled
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px] font-mono text-gray-500 z-10 relative bg-white/[0.02] px-2 py-1 rounded">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Clock size={10} /> IN: <span className="text-gray-300">{inTime}</span>
                                                                </div>
                                                                <div className="text-gray-700">→</div>
                                                                <div className="flex items-center gap-1.5">
                                                                    OUT: <span className={a.clock_out ? "text-gray-300" : "text-green-500 font-bold blink"}>{outTime}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )})
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center opacity-50 text-gray-600 gap-1.5 pt-4">
                                                        <Clock size={16} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">No Active<br/>Clock-ins</span>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Assignment Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f0f13] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-black text-white">Assign Operator</h2>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-500 hover:text-white">
                                <div className="w-4 h-0.5 bg-current rotate-45 absolute" />
                                <div className="w-4 h-0.5 bg-current -rotate-45 absolute" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Target Machine</label>
                                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold">{targetMachine}</div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Shift Type</label>
                                <select 
                                    value={targetShift} 
                                    onChange={e => setTargetShift(e.target.value as any)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Morning">Morning Shift</option>
                                    <option value="Night">Night Shift</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Select Operator</label>
                                <select 
                                    value={selectedOperatorId} 
                                    onChange={e => setSelectedOperatorId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="" disabled>-- Choose Operator --</option>
                                    {operators.map(op => (
                                        <option key={op.employee_id} value={op.employee_id}>
                                            {op.display_name} ({op.position})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4">
                                <button 
                                    onClick={handleAssignSubmit}
                                    disabled={!selectedOperatorId || isSubmitting}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                >
                                    {isSubmitting ? 'Saving...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineSchedule;
